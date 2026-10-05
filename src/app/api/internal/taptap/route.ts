import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { URL } from 'url';

import { TapTapVersion } from '@/app/lib/types/auth';
import { getTapConfig, TapTapProfile, QrCodeData } from '@/app/lib/taptap/qrLogin';
import { upstreamFetch } from '@/app/lib/api/upstreamFetch';

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  kid?: string;
  mac_key?: string;
  mac_algorithm?: string;
};

type Action = 'device_code' | 'poll_token' | 'profile' | 'leancloud';

type LeanCloudUserResponse = {
  sessionToken?: string;
};

type DeviceCodeApiData = {
  device_code?: string;
  user_code?: string;
  qrcode_url?: string;
  verification_url?: string;
  interval?: number;
  expires_in?: number;
  msg?: string;
  error?: string;
};

type DeviceCodeApiResponse = {
  success?: boolean;
  data?: DeviceCodeApiData;
};

type TokenApiResponse = {
  success?: boolean;
  data?: TokenResponse & { error?: string; msg?: string };
};

type TapRequestBody = {
  action: Action;
  version?: TapTapVersion;
  flowId?: string;
  deviceCode?: string;
  deviceId?: string;
  token?: TokenResponse;
  profile?: TapTapProfile;
};

// 需要 Node 环境以使用 crypto/hmac 并允许外部网络
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_ACTIONS: readonly Action[] = ['device_code', 'poll_token', 'profile', 'leancloud'];

// —— 授权流程状态绑定 ——
// 安全说明：poll_token / profile / leancloud 必须携带 device_code 阶段下发的 flowId。
// token 与 profile 由服务端在流程内获取并持有，leancloud 登录只使用服务端持有的
// 状态（忽略客户端传入的 profile/token），杜绝“自造 token + 伪造他人 openid”的注入路径。
type PollStatus = 'pending' | 'waiting' | 'slow_down' | 'denied' | 'error' | 'ok';

/** 服务端侧流程状态：轮询由服务端在后台完成，客户端只读取这里的终态。 */
type FlowStatus = 'pending' | 'ok' | 'denied' | 'expired' | 'error';

type FlowState = {
  version: TapTapVersion;
  deviceId: string;
  deviceCode: string;
  createdAt: number;
  /** 二维码有效期（来自 device_code 的 expires_in），到点停止轮询并标记 expired。 */
  expiresAt: number;
  status: FlowStatus;
  msg?: string;
  /** 当前轮询间隔；遇 slow_down 只增不减，避免反复触发上游限速。 */
  intervalMs: number;
  /** 连续无法联系上游的起始时间；恢复联系后清零。 */
  failureSince: number | null;
  token?: TokenResponse;
  profile?: TapTapProfile;
  used?: boolean;
  /** 是否已有后台轮询循环在跑（用于并发上限计数与重复启动保护）。 */
  polling: boolean;
  timer: NodeJS.Timeout | null;
};

const FLOW_TTL_MS = 10 * 60 * 1000;
const FLOW_SWEEP_INTERVAL = 64;
/** 轮询基准/上限间隔。上限 8s 仍小于 upstreamFetch 连接池的 keepAliveTimeout（30s），连接不被回收。 */
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const MAX_POLL_INTERVAL_MS = 8_000;
/** 连续联系不上上游超过该时长，判定为链路故障并交回客户端提示重试（此前是客户端连续 5 次错误）。 */
const MAX_UPSTREAM_UNREACHABLE_MS = 45_000;
/**
 * 单进程后台轮询循环的并发上限。每个流程一个循环，超过上限时 poll_token 退化为
 * 「同步轮询一次」（即旧行为），保证可用性不被拖垮，也避免内存/定时器无界增长。
 */
const MAX_ACTIVE_POLLERS = 256;

const flows = new Map<string, FlowState>();
let flowOpCount = 0;
let activePollers = 0;

function createFlow(
  version: TapTapVersion,
  deviceId: string,
  deviceCode: string,
  intervalSec: number,
  expiresInSec: number,
): string {
  const flowId = crypto.randomUUID();
  const now = Date.now();
  flows.set(flowId, {
    version,
    deviceId,
    deviceCode,
    createdAt: now,
    expiresAt: now + Math.max(30, expiresInSec) * 1000,
    status: 'pending',
    intervalMs: Math.max(1, intervalSec) * 1000 || DEFAULT_POLL_INTERVAL_MS,
    failureSince: null,
    polling: false,
    timer: null,
  });
  return flowId;
}

function stopFlowPolling(flow: FlowState): void {
  if (flow.timer) {
    clearTimeout(flow.timer);
    flow.timer = null;
  }
  if (flow.polling) {
    flow.polling = false;
    activePollers = Math.max(0, activePollers - 1);
  }
}

function removeFlow(flowId: string): void {
  const flow = flows.get(flowId);
  if (flow) stopFlowPolling(flow);
  flows.delete(flowId);
}

function getFlow(flowId: string | undefined): FlowState | null {
  if (!flowId) return null;
  const flow = flows.get(flowId);
  if (!flow) return null;
  if (Date.now() - flow.createdAt > FLOW_TTL_MS) {
    removeFlow(flowId);
    return null;
  }
  return flow;
}

function sweepFlows(): void {
  const now = Date.now();
  for (const [id, flow] of flows) {
    if (now - flow.createdAt > FLOW_TTL_MS) removeFlow(id);
  }
}

function trackFlowOp(): void {
  flowOpCount += 1;
  if (flowOpCount >= FLOW_SWEEP_INTERVAL) {
    flowOpCount = 0;
    sweepFlows();
  }
}

function finishFlow(flow: FlowState, status: FlowStatus, msg?: string): void {
  stopFlowPolling(flow);
  flow.status = status;
  flow.msg = msg;
}

function scheduleFlowPoll(flowId: string, delayMs: number): void {
  const flow = flows.get(flowId);
  if (!flow || flow.status !== 'pending' || !flow.polling) return;
  const remaining = flow.expiresAt - Date.now();
  const delay = Math.max(0, Math.min(delayMs, remaining));
  flow.timer = setTimeout(() => {
    void runFlowPoll(flowId);
  }, delay);
  // 后台轮询不应阻止进程退出（PM2 reload / 优雅关闭时可正常收尾）
  // 说明：unref 为可选——单元测试的假定时器没有该方法。
  flow.timer.unref?.();
}

/** 将单次上游轮询结果落到 flow 上；返回后由调用方决定是否继续调度。 */
function applyPollResult(flow: FlowState, data: PollResult): void {
  if (data.contacted) {
    flow.failureSince = null;
  } else if (flow.failureSince === null) {
    flow.failureSince = Date.now();
  }

  if (data.status === 'ok' && data.token) {
    flow.token = data.token;
    finishFlow(flow, 'ok');
    return;
  }
  if (data.status === 'denied') {
    finishFlow(flow, 'denied', data.msg);
    return;
  }
  if (data.status === 'slow_down') {
    flow.intervalMs = Math.min(Math.round(flow.intervalMs * 2), MAX_POLL_INTERVAL_MS);
  } else if (data.status === 'pending' || data.status === 'waiting') {
    // 正常授权等待：保持当前节奏（slow_down 后不回落到基准，避免反复触发限速）
  }
  if (
    data.status === 'error' &&
    flow.failureSince !== null &&
    Date.now() - flow.failureSince >= MAX_UPSTREAM_UNREACHABLE_MS
  ) {
    finishFlow(flow, 'error', data.msg || '网络异常，请重试');
  }
}

async function runFlowPoll(flowId: string): Promise<void> {
  const flow = flows.get(flowId);
  if (!flow || flow.status !== 'pending') return;
  if (Date.now() >= flow.expiresAt) {
    finishFlow(flow, 'expired', '二维码已过期，请重新获取');
    return;
  }

  const config = getTapConfig(flow.version);
  let data: PollResult;
  try {
    data = await pollTokenOnceServer(config, flow.deviceCode, flow.deviceId);
  } catch (err) {
    data = { status: 'error', msg: err instanceof Error ? err.message : '轮询上游失败', contacted: false };
  }

  // await 期间流程可能已被清扫 / 结束，重新取一次再落地
  const current = flows.get(flowId);
  if (!current || current.status !== 'pending') return;

  applyPollResult(current, data);
  if (current.status === 'pending') scheduleFlowPoll(flowId, current.intervalMs);
}

function ensureFlowPolling(flowId: string): boolean {
  const flow = flows.get(flowId);
  if (!flow || flow.status !== 'pending') return false;
  if (flow.polling) return true;
  if (activePollers >= MAX_ACTIVE_POLLERS) return false;
  flow.polling = true;
  activePollers += 1;
  scheduleFlowPoll(flowId, 0);
  return true;
}

/** 把服务端 flow 状态翻译成客户端可理解的轮询响应。 */
function toPollResponse(flow: FlowState): { status: PollStatus; token?: TokenResponse; msg?: string } {
  switch (flow.status) {
    case 'ok':
      return flow.token
        ? { status: 'ok', token: flow.token }
        : { status: 'error', msg: '上游未返回授权令牌' };
    case 'denied':
      return { status: 'denied', msg: flow.msg };
    case 'expired':
      return { status: 'denied', msg: flow.msg || '二维码已过期，请重新获取' };
    case 'error':
      return { status: 'error', msg: flow.msg };
    default:
      return { status: 'pending' };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as TapRequestBody;
    const action: Action = body.action;
    const version: TapTapVersion = body.version === 'global' ? 'global' : 'cn';

    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const config = getTapConfig(version);

    if (action === 'device_code') {
      const data = await requestDeviceCodeServer(config);
      const flowId = createFlow(version, data.deviceId, data.deviceCode, data.interval, data.expiresIn);
      trackFlowOp();
      return NextResponse.json({ ...data, flowId });
    }

    if (action === 'poll_token') {
      const flow = getFlow(body.flowId);
      if (!flow) {
        return NextResponse.json({ error: '授权流程无效或已过期' }, { status: 400 });
      }
      // 授权已完成（token 已拿到）：直接回终态，供客户端断线续跑
      if (flow.used || flow.status === 'ok') {
        return NextResponse.json(toPollResponse(flow));
      }
      if (!body.deviceCode || !body.deviceId || body.deviceId !== flow.deviceId) {
        return NextResponse.json({ error: 'deviceCode/deviceId 与授权流程不匹配' }, { status: 400 });
      }

      // 由服务端在后台持续轮询上游；客户端只读状态，跨洋抖动不再中断授权。
      if (flow.status === 'pending' && !ensureFlowPolling(body.flowId as string)) {
        // 后台循环已达并发上限：退化为「同步轮询一次」，保持功能可用。
        const data = await pollTokenOnceServer(config, flow.deviceCode, flow.deviceId);
        applyPollResult(flow, data);
      }
      trackFlowOp();
      return NextResponse.json(toPollResponse(flow));
    }

    if (action === 'profile') {
      const flow = getFlow(body.flowId);
      if (!flow || flow.used) {
        return NextResponse.json({ error: '授权流程无效或已过期' }, { status: 400 });
      }
      if (!flow.token) {
        // 必须先完成 poll_token（拿到 TapTap 真实 token）才能取资料
        return NextResponse.json({ error: '授权尚未完成' }, { status: 400 });
      }
      // 忽略客户端传入的 token，使用服务端持有的 token 获取资料
      const data = await fetchProfileServer(config, flow.token);
      flow.profile = data;
      trackFlowOp();
      return NextResponse.json(data);
    }

    if (action === 'leancloud') {
      const flow = getFlow(body.flowId);
      if (!flow || flow.used) {
        return NextResponse.json({ error: '授权流程无效或已过期' }, { status: 400 });
      }
      if (!flow.token || !flow.profile) {
        return NextResponse.json({ error: '授权尚未完成' }, { status: 400 });
      }
      // 一次性：登录成功后流程作废，防止同一 flowId 被复用
      flow.used = true;
      trackFlowOp();
      try {
        const sessionToken = await loginLeanCloudServer(config, flow.profile, flow.token);
        return NextResponse.json({ sessionToken });
      } catch (err) {
        // 上游瞬时失败时允许重试：恢复 flow 可用状态
        flow.used = false;
        throw err;
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 带重试的上游请求（仅用于一次性调用：device_code / profile / leancloud）。
 *
 * 跨洋链路上单次抖动很常见，此前这些调用零重试，一次超时就直接把整个登录打断。
 * 这里对「网络异常/超时」与 5xx 各重试至多 ATTEMPTS 次（指数退避），4xx 视为业务结果直接返回。
 * poll_token 不走这里——它由后台循环天然重试。
 */
const UPSTREAM_RETRY_ATTEMPTS = 3;
const UPSTREAM_RETRY_BASE_DELAY_MS = 300;

async function fetchUpstreamWithRetry(
  input: string | URL,
  init: RequestInit,
  options: { timeoutMs?: number } = {},
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < UPSTREAM_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const res = await upstreamFetch(input, init, options);
      if (res.status >= 500 && attempt < UPSTREAM_RETRY_ATTEMPTS - 1) {
        await sleep(UPSTREAM_RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < UPSTREAM_RETRY_ATTEMPTS - 1) {
        await sleep(UPSTREAM_RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }
      throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('上游请求失败');
}

async function requestDeviceCodeServer(config: ReturnType<typeof getTapConfig>): Promise<Omit<QrCodeData, 'flowId'>> {
  const deviceId = `web-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const form = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'device_code',
    scope: 'public_profile',
    version: '2.1',
    platform: 'unity',
    info: JSON.stringify({ device_id: deviceId }),
  });

  const res = await fetchUpstreamWithRetry(
    config.deviceCodeEndpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    },
    { timeoutMs: 15_000 },
  );
  const json = (await res.json().catch(() => ({}))) as DeviceCodeApiResponse;
  if (!res.ok || !json?.data?.device_code) {
    throw new Error(json?.data?.msg || '获取设备码失败');
  }
  const data = json.data;
  return {
    deviceCode: data?.device_code ?? '',
    userCode: data?.user_code ?? '',
    qrcodeUrl: data?.qrcode_url || data?.verification_url || '',
    verificationUrl: data?.verification_url ?? '',
    interval: data?.interval ?? 1,
    expiresIn: data?.expires_in ?? 300,
    deviceId,
  };
}

type PollResult = {
  status: PollStatus;
  token?: TokenResponse;
  msg?: string;
  /** 是否真正与上游建立了 HTTP 往返（用于区分链路故障与业务失败）。 */
  contacted: boolean;
};

async function pollTokenOnceServer(
  config: ReturnType<typeof getTapConfig>,
  deviceCode: string,
  deviceId: string,
): Promise<PollResult> {
  const form = new URLSearchParams({
    grant_type: 'device_token',
    client_id: config.clientId,
    secret_type: 'hmac-sha-1',
    code: deviceCode,
    version: '1.0',
    platform: 'unity',
    info: JSON.stringify({ device_id: deviceId }),
  });

  let res: Response;
  try {
    res = await upstreamFetch(
      config.tokenEndpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      },
      { timeoutMs: 10_000 },
    );
  } catch (err) {
    // 链路层失败：contacted=false，交由后台循环退避重试 / 超时判定
    return { status: 'error', msg: err instanceof Error ? err.message : '轮询上游失败', contacted: false };
  }

  const json = (await res.json().catch(() => null)) as TokenApiResponse | null;
  if (json?.success === true && json?.data) {
    return { status: 'ok', token: json.data as TokenResponse, contacted: true };
  }

  const err = json?.data?.error;
  if (err === 'authorization_pending') return { status: 'pending', contacted: true };
  if (err === 'authorization_waiting') return { status: 'waiting', contacted: true };
  if (err === 'slow_down') return { status: 'slow_down', contacted: true };
  if (err === 'access_denied') return { status: 'denied', msg: '用户取消或拒绝授权', contacted: true };
  if (err === 'expired_token') return { status: 'denied', msg: '二维码已过期，请重新获取', contacted: true };
  // 未知响应（网关错误 / 非预期响应体等）：不直接判死，标记为可重试的 error
  return {
    status: 'error',
    msg: json?.data?.msg || `获取授权状态失败（${res.status}）`,
    contacted: true,
  };
}

async function fetchProfileServer(config: ReturnType<typeof getTapConfig>, token: TokenResponse): Promise<TapTapProfile> {
  if (!token.access_token || !token.kid || !token.mac_key || !token.mac_algorithm) {
    throw new Error('TapTap token 数据不完整');
  }
  const hasPublicProfile = token.scope?.includes('public_profile') ?? false;
  const baseProfileUrl = hasPublicProfile
    ? config.userInfoEndpoint.replace('basic-info', 'profile')
    : config.userInfoEndpoint;
  const url = new URL(baseProfileUrl);
  url.searchParams.set('client_id', config.clientId);

  const auth = generateMacHeaderServer(token, 'GET', url);
  const res = await fetchUpstreamWithRetry(
    url,
    {
      headers: {
        Authorization: auth,
      },
    },
    { timeoutMs: 10_000 },
  );
  if (!res.ok) throw new Error(`获取用户资料失败: ${res.status}`);
  return (await res.json()) as TapTapProfile;
}

async function loginLeanCloudServer(
  config: ReturnType<typeof getTapConfig>,
  profile: TapTapProfile,
  token: TokenResponse,
): Promise<string> {
  const timestamp = Date.now();
  const sign = generateLeanCloudSignServer(timestamp, config.leancloudAppKey);
  const base = config.leancloudBaseUrl.replace(/\/$/, '');
  const url = base.endsWith('/1.1') ? `${base}/users` : `${base}/1.1/users`;

  const profileWithIds = profile as TapTapProfile & {
    data?: { openid?: string; unionid?: string };
    openid?: string;
    unionid?: string;
  };
  const openid =
    profileWithIds?.data?.openid ??
    profileWithIds?.openid ??
    profileWithIds?.id;
  const unionid =
    profileWithIds?.data?.unionid ?? profileWithIds?.unionid ?? undefined;

  const authPayload = {
    openid,
    unionid,
    access_token: token.access_token,
    expires_in: token.expires_in,
    token_type: token.token_type,
    scope: token.scope,
    kid: token.kid,
    mac_key: token.mac_key,
    mac_algorithm: token.mac_algorithm,
    profile,
    token,
  };

  const res = await fetchUpstreamWithRetry(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LC-Id': config.leancloudAppId,
        'X-LC-Sign': sign,
      },
      body: JSON.stringify({ authData: { taptap: authPayload } }),
    },
    { timeoutMs: 15_000 },
  );
  if (!res.ok) throw new Error(`LeanCloud 登录失败: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as LeanCloudUserResponse;
  if (!data.sessionToken) throw new Error('LeanCloud 未返回 sessionToken');
  return data.sessionToken;
}

function generateMacHeaderServer(token: TokenResponse, method: 'GET' | 'POST', url: URL) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000);
  const normalized = `${timestamp}\n${nonce}\n${method}\n${url.pathname}${url.search}\n${url.host}\n443\n\n`;
  const hmacAlgo = token.mac_algorithm === 'hmac-sha-256' ? 'sha256' : 'sha1';
  const mac = crypto.createHmac(hmacAlgo, token.mac_key || '').update(normalized).digest('base64');
  return `MAC id="${token.kid}",ts="${timestamp}",nonce="${nonce}",mac="${mac}"`;
}

function generateLeanCloudSignServer(timestamp: number, appKey: string) {
  const hash = crypto.createHash('md5').update(`${timestamp}${appKey}`).digest('hex');
  return `${hash},${timestamp}`;
}
