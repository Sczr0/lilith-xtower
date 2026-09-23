import { TapTapVersion } from '../types/auth';

/**
 * TapTap / LeanCloud 扫码登录核心逻辑（默认使用同源代理避免 CORS）
 */

const TAPSDK_VERSION = '2.1';
const USE_PROXY = typeof window !== 'undefined';

const TAP_CONFIG: Record<
  TapTapVersion,
  {
    deviceCodeEndpoint: string;
    tokenEndpoint: string;
    userInfoEndpoint: string;
    leancloudBaseUrl: string;
    leancloudAppId: string;
    leancloudAppKey: string;
    clientId: string;
  }
> = {
  cn: {
    deviceCodeEndpoint: 'https://accounts.tapapis.cn/oauth2/v1/device/code',
    tokenEndpoint: 'https://accounts.tapapis.cn/oauth2/v1/token',
    userInfoEndpoint: 'https://open.tapapis.cn/account/basic-info/v1',
    leancloudBaseUrl: 'https://rak3ffdi.cloud.tds1.tapapis.cn/1.1',
    leancloudAppId: 'rAK3FfdieFob2Nn8Am',
    leancloudAppKey: 'Qr9AEqtuoSVS3zeD6iVbM4ZC0AtkJcQ89tywVyi0',
    clientId: 'rAK3FfdieFob2Nn8Am',
  },
  global: {
    deviceCodeEndpoint: 'https://accounts.tapapis.com/oauth2/v1/device/code',
    tokenEndpoint: 'https://accounts.tapapis.com/oauth2/v1/token',
    userInfoEndpoint: 'https://open.tapapis.com/account/basic-info/v1',
    leancloudBaseUrl: 'https://kviehlel.cloud.ap-sg.tapapis.com/1.1',
    leancloudAppId: 'kviehleldgxsagpozb',
    leancloudAppKey: 'tG9CTm0LDD736k9HMM9lBZrbeBGRmUkjSfNLDNib',
    clientId: 'kviehleldgxsagpozb',
  },
};

export type TapTapProfile = {
  id: string;
  name: string;
  avatar: string;
  bio?: string;
  gender?: string;
  birthday?: string;
  region?: string;
  verified: boolean;
};

type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_url: string;
  qrcode_url: string;
  interval?: number;
  expires_in?: number;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  kid?: string;
  mac_key?: string;
  mac_algorithm?: string;
};

type LeanCloudUserResponse = {
  sessionToken?: string;
};

export type QrCodeData = {
  deviceCode: string;
  userCode: string;
  qrcodeUrl: string;
  verificationUrl: string;
  interval: number;
  expiresIn: number;
  deviceId: string;
  /**
   * 授权流程 ID（仅经 /api/internal/taptap 代理时由服务端下发）。
   * poll_token / profile / leancloud 必须携带该 ID，服务端据此绑定 token 与 profile。
   * 非代理（Node 直连）路径无此字段，恒为空串。
   */
  flowId: string;
};

const generateDeviceId = () => `web-${Date.now()}-${Math.floor(Math.random() * 114514)}`;

const toFormBody = (data: Record<string, string | number>) =>
  Object.entries(data)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

const proxyFetch = async <T>(action: string, payload: Record<string, unknown>, signal?: AbortSignal) => {
  const res = await fetch('/api/internal/taptap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
    signal,
  });
  if (!res.ok) {
    // 服务端错误体为 { error } / { msg }：优先提取其中的可读文案，
    // 避免把原始 JSON（如 {"error":"请求过于频繁，请稍后重试"}）直接抛到界面。
    const text = await res.text().catch(() => '');
    throw new Error(extractFriendlyError(text) || `请求失败: ${res.status}`);
  }
  return (await res.json()) as T;
};

/** 从代理返回的错误体里提取人类可读文案（兼容 JSON / 纯文本）。 */
function extractFriendlyError(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: unknown; msg?: unknown; message?: unknown };
      for (const candidate of [parsed?.error, parsed?.msg, parsed?.message]) {
        if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
      }
      return '';
    } catch {
      return '';
    }
  }
  return trimmed;
}

export async function requestTapTapDeviceCode(
  version: TapTapVersion,
  signal?: AbortSignal,
): Promise<QrCodeData> {
  if (USE_PROXY) {
    return proxyFetch<QrCodeData>('device_code', { version }, signal);
  }

  const config = TAP_CONFIG[version];
  const deviceId = generateDeviceId();
  const body = toFormBody({
    client_id: config.clientId,
    response_type: 'device_code',
    scope: 'public_profile',
    version: TAPSDK_VERSION,
    platform: 'unity',
    info: JSON.stringify({ device_id: deviceId }),
  });

  const res = await fetch(config.deviceCodeEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.data?.device_code) {
    throw new Error(json?.data?.msg || '获取二维码失败');
  }

  const data = json.data as DeviceCodeResponse;
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    qrcodeUrl: data.qrcode_url || data.verification_url,
    verificationUrl: data.verification_url,
    interval: data.interval ?? 1,
    expiresIn: data.expires_in ?? 300,
    deviceId,
    flowId: '',
  };
}

/**
 * 单次轮询的归一化结果。
 *
 * 说明：轮询期间上游可能返回各种瞬时异常（网关 5xx、限流 slow_down、非预期响应体…）。
 * 这些都不应被当作「用户拒绝授权」直接判死，统一归为 error / slow_down 交给调用方退避重试；
 * 只有明确的 access_denied / expired_token 才终止流程。
 */
type PollOutcome =
  | { kind: 'ok'; token: TokenResponse }
  | { kind: 'pending' }
  | { kind: 'slow_down' }
  | { kind: 'denied'; msg?: string }
  | { kind: 'error'; msg?: string };

type PollStatusResponse = {
  status?: 'pending' | 'waiting' | 'slow_down' | 'denied' | 'error' | 'ok';
  token?: TokenResponse;
  msg?: string;
};

/** 轮询期间允许的连续瞬时失败次数，超过则终止并提示重新获取。 */
const MAX_CONSECUTIVE_POLL_ERRORS = 5;
/** 退避间隔上限，避免 slow_down / 抖动把等待拖得过长。 */
const MAX_POLL_INTERVAL_MS = 8_000;

async function pollOnceViaProxy(
  version: TapTapVersion,
  deviceCode: string,
  deviceId: string,
  flowId: string | undefined,
  signal?: AbortSignal,
): Promise<PollOutcome> {
  const res = await proxyFetch<PollStatusResponse>(
    'poll_token',
    { version, flowId, deviceCode, deviceId },
    signal,
  );
  switch (res.status) {
    case 'ok':
      return res.token ? { kind: 'ok', token: res.token } : { kind: 'error', msg: '上游未返回授权令牌' };
    case 'denied':
      return { kind: 'denied', msg: res.msg };
    case 'slow_down':
      return { kind: 'slow_down' };
    case 'error':
      return { kind: 'error', msg: res.msg };
    default:
      // pending / waiting / 未知状态：按可继续处理，避免误伤
      return { kind: 'pending' };
  }
}

async function pollOnceDirect(
  version: TapTapVersion,
  deviceCode: string,
  deviceId: string,
  signal?: AbortSignal,
): Promise<PollOutcome> {
  const config = TAP_CONFIG[version];
  const body = toFormBody({
    grant_type: 'device_token',
    client_id: config.clientId,
    secret_type: 'hmac-sha-1',
    code: deviceCode,
    version: '1.0',
    platform: 'unity',
    info: JSON.stringify({ device_id: deviceId }),
  });

  const res = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal,
  });
  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; data?: TokenResponse & { error?: string; msg?: string } }
    | null;

  if (json?.success === true && json.data) return { kind: 'ok', token: json.data };

  const err = json?.data?.error;
  if (err === 'access_denied') return { kind: 'denied', msg: '用户取消或拒绝授权' };
  if (err === 'expired_token') return { kind: 'denied', msg: '二维码已过期，请重新获取' };
  if (err === 'slow_down') return { kind: 'slow_down' };
  if (err === 'authorization_pending' || err === 'authorization_waiting') return { kind: 'pending' };
  return { kind: 'error', msg: json?.data?.msg || `获取授权状态失败（${res.status}）` };
}

export async function pollTapTapToken(
  version: TapTapVersion,
  deviceCode: string,
  deviceId: string,
  intervalMs: number,
  timeoutMs: number,
  signal?: AbortSignal,
  flowId?: string,
): Promise<TokenResponse> {
  const start = Date.now();
  const baseInterval = intervalMs > 0 ? intervalMs : 1000;
  let interval = baseInterval;
  let consecutiveErrors = 0;

  while (true) {
    if (signal?.aborted) throw new DOMException('轮询已取消', 'AbortError');

    let outcome: PollOutcome;
    try {
      outcome = USE_PROXY
        ? await pollOnceViaProxy(version, deviceCode, deviceId, flowId, signal)
        : await pollOnceDirect(version, deviceCode, deviceId, signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      if (signal?.aborted) throw new DOMException('轮询已取消', 'AbortError');
      // 到自身代理/上游的网络异常同样按瞬时故障处理，交由下方退避重试
      outcome = { kind: 'error', msg: err instanceof Error ? err.message : '网络异常' };
    }

    if (outcome.kind === 'ok') return outcome.token;
    if (outcome.kind === 'denied') throw new Error(outcome.msg || '用户取消或拒绝授权');

    if (outcome.kind === 'error') {
      consecutiveErrors += 1;
      if (consecutiveErrors > MAX_CONSECUTIVE_POLL_ERRORS) {
        throw new Error(outcome.msg || '网络异常，请重新获取二维码');
      }
      interval = Math.min(interval * 2, MAX_POLL_INTERVAL_MS);
    } else if (outcome.kind === 'slow_down') {
      consecutiveErrors = 0;
      interval = Math.min(interval * 2, MAX_POLL_INTERVAL_MS);
    } else {
      // pending / waiting：恢复正常节奏
      consecutiveErrors = 0;
      interval = baseInterval;
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error('扫描超时，请重新获取二维码');
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

export async function fetchTapTapProfile(
  version: TapTapVersion,
  token: TokenResponse,
  signal?: AbortSignal,
  flowId?: string,
): Promise<TapTapProfile> {
  if (!token.access_token) throw new Error('缺少 access_token，无法获取用户信息');

  if (USE_PROXY) {
    return proxyFetch<TapTapProfile>('profile', { version, flowId }, signal);
  }

  const config = TAP_CONFIG[version];
  const hasPublicProfile = token.scope?.includes('public_profile') ?? false;
  const baseProfileUrl = hasPublicProfile
    ? config.userInfoEndpoint.replace('basic-info', 'profile')
    : config.userInfoEndpoint;
  const url = new URL(baseProfileUrl);
  url.searchParams.set('client_id', config.clientId);

  const auth = await generateMacHeader(token, 'GET', url);
  const res = await fetch(url.toString(), { headers: { Authorization: auth }, signal });
  if (!res.ok) throw new Error(`获取用户资料失败: ${res.status}`);
  return (await res.json()) as TapTapProfile;
}

export async function loginLeanCloudWithTapTap(
  version: TapTapVersion,
  profile: TapTapProfile,
  token: TokenResponse,
  signal?: AbortSignal,
  flowId?: string,
): Promise<string> {
  if (USE_PROXY) {
    const res = await proxyFetch<{ sessionToken: string }>('leancloud', {
      version,
      flowId,
      // 说明：经代理时服务端只使用其自身持有的 token/profile（按 flowId 绑定），
      // 此处仍携带仅供展示/兼容；服务端会忽略这些字段。
      profile,
      token,
    }, signal);
    if (!res.sessionToken) throw new Error('LeanCloud 未返回 sessionToken');
    return res.sessionToken;
  }

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
    // 保留完整数据便于兼容
    profile,
    token,
  };

  const config = TAP_CONFIG[version];
  const sign = await generateLeanCloudSign(config.leancloudAppKey);
  const base = config.leancloudBaseUrl.replace(/\/$/, '');
  const url = base.endsWith('/1.1') ? `${base}/users` : `${base}/1.1/users`;

  const body = { authData: { taptap: authPayload } };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LC-Id': config.leancloudAppId,
      'X-LC-Sign': sign,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`LeanCloud 登录失败: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as LeanCloudUserResponse;
  if (!data.sessionToken) throw new Error('LeanCloud 未返回 sessionToken');
  return data.sessionToken;
}


const generateMacHeader = async (token: TokenResponse, method: 'GET' | 'POST', url: URL) => {
  if (!token.kid || !token.mac_key || !token.mac_algorithm) {
    throw new Error('TapTap token 数据不完整');
  }
  const nonce = Math.floor(Math.random() * 1_000_000).toString();
  const timestamp = Math.floor(Date.now() / 1000);
  const normalized = `${timestamp}\n${nonce}\n${method}\n${url.pathname}${url.search}\n${url.host}\n443\n\n`;
  const encoder = new TextEncoder();
  const key = encoder.encode(token.mac_key);
  const data = encoder.encode(normalized);
  const hashName = token.mac_algorithm === 'hmac-sha-256' ? 'SHA-256' : 'SHA-1';
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: hashName }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  const macValue = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `MAC id="${token.kid}",ts="${timestamp}",nonce="${nonce}",mac="${macValue}"`;
};

const generateLeanCloudSign = async (appKey: string) => {
  const timestamp = Date.now();
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('MD5', encoder.encode(`${timestamp}${appKey}`));
  const hashArray = Array.from(new Uint8Array(buffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hashHex},${timestamp}`;
};

export const getTapConfig = (version: TapTapVersion) => TAP_CONFIG[version];
export type { TokenResponse };


export async function completeTapTapQrLogin(
  version: TapTapVersion,
  qr: QrCodeData,
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<{ sessionToken: string; profile: TapTapProfile; token: TokenResponse }> {
  const timeoutMs = options?.timeoutMs ?? 120_000;

  const token = await pollTapTapToken(
    version,
    qr.deviceCode,
    qr.deviceId,
    qr.interval * 1000,
    timeoutMs,
    options?.signal,
    qr.flowId,
  );
  if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const profile = await fetchTapTapProfile(version, token, options?.signal, qr.flowId);
  if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const sessionToken = await loginLeanCloudWithTapTap(version, profile, token, options?.signal, qr.flowId);
  return { sessionToken, profile, token };
}
