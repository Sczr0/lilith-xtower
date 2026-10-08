import { DurableObject } from 'cloudflare:workers';

import { MIN_EXPIRES_IN_SECS, QR_TTL_MS, TAP_CONFIG, type TapTapVersion } from './config';
import { toRetryAfterSecs, type FlowState, type QrStatusResponse } from './state';
import { AuthPendingError, classifyError, pollForToken } from './tap';

export interface Env {
  TAP_FLOW: DurableObjectNamespace<TapTapFlow>;
  /** proxy = 透传 seekend（灰度/回滚/CN 兜底）；do = 本地 DO 处理。 */
  HANDLE_MODE?: string;
  /** 命中这些国家码即透传（国内兜底），逗号分隔；留空表示不按国家兜底。 */
  CN_FALLBACK_COUNTRIES?: string;
  /** 透传目标基址（默认 seekend 的业务前缀）。 */
  PROXY_BASE?: string;
}

export type StatusOutcome = {
  res: QrStatusResponse;
  /** 本次真正打上游的耗时（ms）；status() 不再打上游，恒为 0。 */
  upstreamMs: number;
  /** 本次是否真的向上游发起了一次轮询；status() 不再打上游，恒为 false。 */
  polled: boolean;
};

/** 上游瞬时错误：按 interval 继续重试；其余错误视为终态，停止轮询。 */
function isTransient(errorCode: string): boolean {
  return errorCode === 'UPSTREAM_ERROR' || errorCode === 'UPSTREAM_TIMEOUT';
}

/**
 * 每个 qrId 一个 DO 实例，替代后端的 Moka 进程内缓存（可水平扩展、抗重启）。
 *
 * 轮询模型与后端不同：上游轮询由 DO 的 **alarm** 驱动，`status()` 只读本地状态、
 * 永不 await 上游。这样客户端 1–2s 的高频轮询不会堆积跨境调用，也不会因为
 * “先 await 后推进节流” 而并发打同一个一次性 device_code。
 */
export class TapTapFlow extends DurableObject<Env> {
  private data: FlowState | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const stored = (await ctx.storage.get<FlowState>('state')) ?? null;
      // 兼容部署前的旧状态（缺少 status/sessionToken/error* 字段）：一律按 pending 处理。
      if (stored && stored.status !== 'confirmed' && stored.status !== 'error') stored.status = 'pending';
      this.data = stored;
    });
  }

  private async save(): Promise<void> {
    if (this.data) await this.ctx.storage.put('state', this.data);
  }

  private async clear(): Promise<void> {
    this.data = null;
    await this.ctx.storage.delete('state');
    await this.ctx.storage.deleteAlarm();
  }

  private expired(d: FlowState, now: number): boolean {
    return now - d.createdAt > QR_TTL_MS || now >= d.expiresAt;
  }

  async create(input: {
    version: TapTapVersion;
    deviceId: string;
    deviceCode: string;
    intervalSec: number;
    expiresInSec: number;
  }): Promise<void> {
    const now = Date.now();
    this.data = {
      version: input.version,
      deviceId: input.deviceId,
      deviceCode: input.deviceCode,
      createdAt: now,
      expiresAt: now + Math.max(MIN_EXPIRES_IN_SECS, input.expiresInSec) * 1000,
      intervalMs: Math.max(1, input.intervalSec) * 1000,
      nextPollAt: now,
      status: 'pending',
    };
    await this.save();
    // 立刻拉起第一轮上游轮询；后续由 pollOnce 自行续期。
    await this.ctx.storage.setAlarm(now);
  }

  /** 纯本地读：不 await 上游，毫秒级返回。 */
  async status(): Promise<StatusOutcome> {
    const d = this.data;
    if (!d) return { res: { status: 'Expired', message: '二维码不存在或已过期' }, upstreamMs: 0, polled: false };

    const now = Date.now();
    if (this.expired(d, now)) {
      await this.clear();
      return { res: { status: 'Expired', message: '二维码已过期' }, upstreamMs: 0, polled: false };
    }

    if (d.status === 'confirmed' && d.sessionToken) {
      const sessionToken = d.sessionToken;
      // 一次性：被取走即作废（与后端 set_confirmed + remove 一致）
      await this.clear();
      return { res: { status: 'Confirmed', sessionToken }, upstreamMs: 0, polled: false };
    }
    if (d.status === 'error') {
      return {
        res: { status: 'Error', errorCode: d.errorCode, message: d.errorMessage },
        upstreamMs: 0,
        polled: false,
      };
    }

    // pending：自愈式补闹钟（覆盖部署前遗留的旧状态，以及闹钟意外丢失的情况）
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(d.nextPollAt);
    }
    return {
      res: { status: 'Pending', retryAfter: toRetryAfterSecs(Math.max(0, d.nextPollAt - now)) },
      upstreamMs: 0,
      polled: false,
    };
  }

  /** 闹钟：在 DO 内按 interval 打上游，与客户端轮询解耦。 */
  async alarm(): Promise<void> {
    const d = this.data;
    if (!d) return;
    if (this.expired(d, Date.now())) {
      await this.clear();
      return;
    }
    // 已确认/已终态：保留结果等 status() 取走，只需确保不再有闹钟。
    if (d.status !== 'pending') {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.pollOnce();
  }

  private async pollOnce(): Promise<void> {
    const d = this.data;
    if (!d || d.status !== 'pending') return;

    // 关键：在真正打上游之前就推进并持久化 nextPollAt。
    // 即使本轮被重复触发，也不会同时越过节流、并发打同一个一次性 device_code。
    d.nextPollAt = Date.now() + d.intervalMs;
    await this.save();

    try {
      const sessionToken = await pollForToken(TAP_CONFIG[d.version], d.deviceCode, d.deviceId);
      d.status = 'confirmed';
      d.sessionToken = sessionToken;
      d.nextPollAt = 0;
      await this.save();
      await this.ctx.storage.deleteAlarm();
    } catch (err) {
      if (err instanceof AuthPendingError) {
        await this.ctx.storage.setAlarm(d.nextPollAt);
        return;
      }
      const { errorCode, message } = classifyError(err);
      if (isTransient(errorCode)) {
        await this.ctx.storage.setAlarm(d.nextPollAt);
        return;
      }
      // 终态错误（凭证无效等）：落盘后停止轮询，等 status() 取走。
      d.status = 'error';
      d.errorCode = errorCode;
      d.errorMessage = message;
      d.nextPollAt = 0;
      await this.save();
      await this.ctx.storage.deleteAlarm();
    }
  }
}
