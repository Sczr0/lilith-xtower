import { DurableObject } from 'cloudflare:workers';

import { QR_TTL_MS, TAP_CONFIG, type TapTapVersion } from './config';
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
  /** 本次真正打上游的耗时（ms）；未打上游为 0。 */
  upstreamMs: number;
  /** 本次是否真的向上游发起了一次轮询。 */
  polled: boolean;
};

/**
 * 每个 qrId 一个 DO 实例，替代后端的 Moka 进程内缓存（可水平扩展、抗重启）。
 * 「轮询即上游」+ `nextPollAt` 节流与后端 `get_qrcode_status` 一致。
 */
export class TapTapFlow extends DurableObject<Env> {
  private data: FlowState | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.data = (await ctx.storage.get<FlowState>('state')) ?? null;
    });
  }

  private async save(): Promise<void> {
    if (this.data) await this.ctx.storage.put('state', this.data);
  }

  private async clear(): Promise<void> {
    this.data = null;
    await this.ctx.storage.delete('state');
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
      expiresAt: now + Math.max(30, input.expiresInSec) * 1000,
      intervalMs: Math.max(1, input.intervalSec) * 1000,
      nextPollAt: now,
    };
    await this.save();
  }

  async status(): Promise<StatusOutcome> {
    const d = this.data;
    if (!d) return { res: { status: 'Expired', message: '二维码不存在或已过期' }, upstreamMs: 0, polled: false };

    const now = Date.now();
    if (now - d.createdAt > QR_TTL_MS || now >= d.expiresAt) {
      await this.clear();
      return { res: { status: 'Expired', message: '二维码已过期' }, upstreamMs: 0, polled: false };
    }
    if (now < d.nextPollAt) {
      return { res: { status: 'Pending', retryAfter: toRetryAfterSecs(d.nextPollAt - now) }, upstreamMs: 0, polled: false };
    }

    const t0 = performance.now();
    try {
      const sessionToken = await pollForToken(TAP_CONFIG[d.version], d.deviceCode, d.deviceId);
      const upstreamMs = performance.now() - t0;
      // 一次性：拿到 sessionToken 即作废（与后端 set_confirmed + remove 一致）
      await this.clear();
      return { res: { status: 'Confirmed', sessionToken }, upstreamMs, polled: true };
    } catch (err) {
      const upstreamMs = performance.now() - t0;
      // 无论 pending 还是错误都退避，避免客户端重试把上游打爆
      d.nextPollAt = Date.now() + d.intervalMs;
      await this.save();
      if (err instanceof AuthPendingError) {
        return { res: { status: 'Pending', retryAfter: toRetryAfterSecs(d.intervalMs) }, upstreamMs, polled: true };
      }
      const { errorCode, message } = classifyError(err);
      return { res: { status: 'Error', errorCode, message }, upstreamMs, polled: true };
    }
  }
}
