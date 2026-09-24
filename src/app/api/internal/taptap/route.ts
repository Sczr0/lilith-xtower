import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { URL } from 'url';

import { TapTapVersion } from '@/app/lib/types/auth';
import { getTapConfig, TapTapProfile, QrCodeData } from '@/app/lib/taptap/qrLogin';
import { resolveClientIp, slidingWindowAllow } from '@/app/lib/api/rateLimit';
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

// —— 按 action 的 IP 限流（滑动窗口，单实例） ——
const RATE_LIMITS: Record<Action, { limit: number; windowMs: number }> = {
  device_code: { limit: 30, windowMs: 60_000 }, // 二维码获取：每次登录仅 1 次，留出重试余量
  poll_token: { limit: 240, windowMs: 60_000 }, // 轮询：间隔 1s 时 120 秒最多 ~120 次
  profile: { limit: 30, windowMs: 60_000 },
  leancloud: { limit: 10, windowMs: 60_000 }, // 登录落库：低频
};

/**
 * 拿不到可信客户端 IP 时（resolveClientIp 返回 'unknown'），所有访客会共享同一个限流桶。
 * 若沿用单 IP 的严格限额，一旦部署侧未配置 TRUSTED_CLIENT_IP_HEADER，整站登录会被一起限流成 429。
 * 这里对共享桶放宽到 N 倍：既保留兜底上限（防止伪造头绕过），又不至于把正常访客挡在门外。
 */
const UNKNOWN_IP_LIMIT_MULTIPLIER = 10;

function rateLimitKey(ip: string, action: Action): string {
  return `taptap:${ip}:${action}`;
}

function resolveRateLimit(ip: string, action: Action): { key: string; limit: number; windowMs: number } {
  const { limit, windowMs } = RATE_LIMITS[action];
  return {
    key: rateLimitKey(ip, action),
    limit: ip === 'unknown' ? limit * UNKNOWN_IP_LIMIT_MULTIPLIER : limit,
    windowMs,
  };
}

// —— 授权流程状态绑定 ——
// 安全说明：poll_token / profile / leancloud 必须携带 device_code 阶段下发的 flowId。
// token 与 profile 由服务端在流程内获取并持有，leancloud 登录只使用服务端持有的
// 状态（忽略客户端传入的 profile/token），杜绝“自造 token + 伪造他人 openid”的注入路径。
type FlowState = {
  version: TapTapVersion;
  deviceId: string;
  createdAt: number;
  token?: TokenResponse;
  profile?: TapTapProfile;
  used?: boolean;
};

const FLOW_TTL_MS = 10 * 60 * 1000;
const FLOW_SWEEP_INTERVAL = 64;
const flows = new Map<string, FlowState>();
let flowOpCount = 0;

function createFlow(version: TapTapVersion, deviceId: string): string {
  const flowId = crypto.randomUUID();
  flows.set(flowId, { version, deviceId, createdAt: Date.now() });
  return flowId;
}

function getFlow(flowId: string | undefined): FlowState | null {
  if (!flowId) return null;
  const flow = flows.get(flowId);
  if (!flow) return null;
  if (Date.now() - flow.createdAt > FLOW_TTL_MS) {
    flows.delete(flowId);
    return null;
  }
  return flow;
}

function sweepFlows(): void {
  const now = Date.now();
  for (const [id, flow] of flows) {
    if (now - flow.createdAt > FLOW_TTL_MS) flows.delete(id);
  }
}

function trackFlowOp(): void {
  flowOpCount += 1;
  if (flowOpCount >= FLOW_SWEEP_INTERVAL) {
    flowOpCount = 0;
    sweepFlows();
  }
}

export async function POST(req: NextRequest) {
  const ip = resolveClientIp(req);

  try {
    const body = (await req.json().catch(() => ({}))) as TapRequestBody;
    const action: Action = body.action;
    const version: TapTapVersion = body.version === 'global' ? 'global' : 'cn';

    if (!action || !(action in RATE_LIMITS)) {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const { key, limit, windowMs } = resolveRateLimit(ip, action);
    if (!slidingWindowAllow(key, limit, windowMs)) {
      return NextResponse.json({ error: '请求过于频繁，请稍后重试' }, { status: 429 });
    }

    const config = getTapConfig(version);

    if (action === 'device_code') {
      const data = await requestDeviceCodeServer(config);
      const flowId = createFlow(version, data.deviceId);
      trackFlowOp();
      return NextResponse.json({ ...data, flowId });
    }

    if (action === 'poll_token') {
      const flow = getFlow(body.flowId);
      if (!flow || flow.used) {
        return NextResponse.json({ error: '授权流程无效或已过期' }, { status: 400 });
      }
      if (!body.deviceCode || !body.deviceId || body.deviceId !== flow.deviceId) {
        return NextResponse.json({ error: 'deviceCode/deviceId 与授权流程不匹配' }, { status: 400 });
      }
      const data = await pollTokenOnceServer(config, body.deviceCode, body.deviceId);
      if (data.status === 'ok' && data.token) {
        flow.token = data.token;
      }
      trackFlowOp();
      return NextResponse.json(data);
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

  const res = await upstreamFetch(
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

type PollStatus = 'pending' | 'waiting' | 'slow_down' | 'denied' | 'error' | 'ok';

async function pollTokenOnceServer(
  config: ReturnType<typeof getTapConfig>,
  deviceCode: string,
  deviceId: string,
): Promise<{ status: PollStatus; token?: TokenResponse; msg?: string }> {
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
    // 上游网络异常按瞬时故障返回，交由客户端退避重试，避免一次抖动就判死整个登录
    return { status: 'error', msg: err instanceof Error ? err.message : '轮询上游失败' };
  }

  const json = (await res.json().catch(() => null)) as TokenApiResponse | null;
  if (json?.success === true && json?.data) {
    return { status: 'ok', token: json.data as TokenResponse };
  }

  const err = json?.data?.error;
  if (err === 'authorization_pending') return { status: 'pending' };
  if (err === 'authorization_waiting') return { status: 'waiting' };
  if (err === 'slow_down') return { status: 'slow_down' };
  if (err === 'access_denied') return { status: 'denied', msg: '用户取消或拒绝授权' };
  if (err === 'expired_token') return { status: 'denied', msg: '二维码已过期，请重新获取' };
  // 未知响应（网关错误 / 非预期响应体等）：不直接判死，标记为可重试的 error
  return { status: 'error', msg: json?.data?.msg || `获取授权状态失败（${res.status}）` };
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
  const res = await upstreamFetch(
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

  const res = await upstreamFetch(
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
