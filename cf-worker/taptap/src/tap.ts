import {
  DEVICE_CODE_FORM_VERSION,
  DEFAULT_EXPIRES_IN_SECS,
  DEFAULT_INTERVAL_SECS,
  LEANCLOUD_USER_AGENT,
  POLL_TIMEOUT_MS,
  TAP_USER_AGENT,
  UPSTREAM_TIMEOUT_MS,
  type TapConfig,
} from './config';

/**
 * TapTap / LeanCloud 客户端 —— 1:1 移植自后端 `Next-Phi-Backend`
 * `crates/impl-upstream/src/client.rs` 的 `TapTapClient`。
 *
 * 关键差异（相对我们原来的源站 route 实现）：
 * - `poll_for_token` **一次调用**完成 token 交换 → 取用户资料（MAC 头）→ LeanCloud 登录，返回 LeanCloud sessionToken；
 * - LeanCloud 用 `X-LC-Id` + `X-LC-Key` 鉴权，**不需要 MD5 签名**（故不引入 md5）；
 * - MAC 头的 nonce 用 u32 十进制、固定 HMAC-SHA1、端口固定 443。
 */

export type DeviceCode = {
  deviceCode: string;
  userCode?: string;
  verificationUrl: string;
  qrcodeUrl?: string;
  interval: number;
  expiresIn: number;
};

type Token = { kid: string; mac_key: string };
type Account = { openid: string; unionid: string };

/** 用户尚未授权（上游 authorization_pending / waiting / slow_down）。 */
export class AuthPendingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthPendingError';
  }
}
/** 上游认证/业务错误（凭证无效等）。 */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
/** 上游网络错误。 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}
/** 上游超时。 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function fetchUpstream(input: string | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(input, { ...init, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/abort|timeout/i.test(msg)) throw new TimeoutError(`上游超时: ${msg}`);
    throw new NetworkError(`上游网络错误: ${msg}`);
  }
}

function businessError(body: unknown): { code: string; message: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as { success?: unknown; data?: unknown };
  if (b.success === true) return null;
  const data = b.data;
  if (typeof data === 'object' && data !== null) {
    const d = data as { error?: unknown; error_description?: unknown; msg?: unknown };
    const code = typeof d.error === 'string' ? d.error : '';
    const message =
      typeof d.error_description === 'string' ? d.error_description : typeof d.msg === 'string' ? d.msg : '';
    return { code, message };
  }
  if (typeof data === 'string') return { code: '', message: data };
  return { code: '', message: data === undefined || data === null ? '' : JSON.stringify(data) };
}

/** 设备码申请：POST device_code_endpoint（对应后端 `request_device_code`）。 */
export async function requestDeviceCode(config: TapConfig, deviceId: string): Promise<DeviceCode> {
  const form = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'device_code',
    scope: 'basic_info',
    version: DEVICE_CODE_FORM_VERSION,
    platform: 'unity',
    info: JSON.stringify({ device_id: deviceId }),
  });

  const res = await fetchUpstream(
    config.deviceCodeEndpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': TAP_USER_AGENT },
      body: form.toString(),
    },
    UPSTREAM_TIMEOUT_MS,
  );

  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new NetworkError(`TapTap 设备码响应解析失败`);
  }

  if (!res.ok) throw new NetworkError(`TapTap 设备码请求失败: HTTP ${res.status}`);

  const err = businessError(body);
  if (err) {
    const detail = err.message.trim() || err.code.trim();
    throw new AuthError(detail ? `TapTap 设备码申请失败: ${detail}` : 'TapTap 设备码申请失败');
  }

  const data = (body as { data?: Record<string, unknown> }).data ?? {};
  const deviceCode = data.device_code;
  if (typeof deviceCode !== 'string' || !deviceCode) {
    throw new NetworkError('TapTap 未返回 device_code');
  }
  return {
    deviceCode,
    userCode: typeof data.user_code === 'string' ? data.user_code : undefined,
    verificationUrl: typeof data.verification_url === 'string' ? data.verification_url : '',
    qrcodeUrl: typeof data.qrcode_url === 'string' ? data.qrcode_url : undefined,
    interval: typeof data.interval === 'number' && data.interval > 0 ? data.interval : DEFAULT_INTERVAL_SECS,
    expiresIn:
      typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : DEFAULT_EXPIRES_IN_SECS,
  };
}

/** 生成 TapTap 用户资料接口所需的 MAC 认证头（HMAC-SHA1，nonce 为 u32 十进制）。 */
async function buildMacAuthorization(token: Token, url: URL): Promise<string> {
  const ts = Math.floor(Date.now() / 1000);
  const nonce = crypto.getRandomValues(new Uint32Array(1))[0];
  const pathAndQuery = url.search ? `${url.pathname}${url.search}` : url.pathname;
  const input = `${ts}\n${nonce}\nGET\n${pathAndQuery}\n${url.host}\n443\n\n`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(token.mac_key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input));
  const mac = toBase64(new Uint8Array(sig));
  return `MAC id="${token.kid}",ts="${ts}",nonce="${nonce}",mac="${mac}"`;
}

/**
 * 轮询一次并（在授权后）完成 token → 资料 → LeanCloud，返回 sessionToken。
 * 对应后端 `TapTapClient::poll_for_token`。未授权时抛 `AuthPendingError`。
 */
export async function pollForToken(config: TapConfig, deviceCode: string, deviceId: string): Promise<string> {
  // 1) token 交换
  const tokenForm = new URLSearchParams({
    grant_type: 'device_token',
    client_id: config.clientId,
    secret_type: 'hmac-sha-1',
    code: deviceCode,
    version: '1.0',
    platform: 'unity',
    info: JSON.stringify({ device_id: deviceId }),
  });

  const tokenRes = await fetchUpstream(
    config.tokenEndpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': TAP_USER_AGENT },
      body: tokenForm.toString(),
    },
    POLL_TIMEOUT_MS,
  );

  const tokenText = await tokenRes.text();
  let tokenBody: unknown;
  try {
    tokenBody = JSON.parse(tokenText);
  } catch {
    tokenBody = null;
  }

  // 业务错误优先判定（与后端一致）：pending/waiting/slow_down → AuthPendingError
  const tokenErr = businessError(tokenBody);
  if (tokenErr) {
    const classifier = `${tokenErr.code} ${tokenErr.message}`.toLowerCase();
    const msg = tokenErr.message.trim() || (tokenErr.code.trim() ? `TapTap 业务错误: ${tokenErr.code}` : 'TapTap 业务错误');
    if (
      classifier.includes('authorization_pending') ||
      classifier.includes('authorization_waiting') ||
      classifier.includes('slow_down') ||
      classifier.includes('end-user authorization is waiting')
    ) {
      throw new AuthPendingError(msg);
    }
    throw new AuthError(msg);
  }
  if (!tokenRes.ok) throw new NetworkError(`TapTap token 请求失败: HTTP ${tokenRes.status}`);
  if (tokenBody === null) throw new NetworkError('TapTap token 响应解析失败');

  const tokenData = (tokenBody as { data?: { kid?: unknown; mac_key?: unknown } }).data ?? {};
  if (typeof tokenData.kid !== 'string' || typeof tokenData.mac_key !== 'string') {
    throw new NetworkError('TapTap token 数据解析失败');
  }
  const token: Token = { kid: tokenData.kid, mac_key: tokenData.mac_key };

  // 2) 取用户资料（MAC 头）
  const userInfoUrl = new URL(config.userInfoEndpoint);
  userInfoUrl.searchParams.set('client_id', config.clientId);
  const authorization = await buildMacAuthorization(token, userInfoUrl);
  const accountRes = await fetchUpstream(
    userInfoUrl,
    { headers: { 'User-Agent': TAP_USER_AGENT, Authorization: authorization } },
    POLL_TIMEOUT_MS,
  );
  if (!accountRes.ok) throw new NetworkError(`TapTap 账号信息请求失败: HTTP ${accountRes.status}`);
  const accountWrap = (await accountRes.json().catch(() => null)) as { success?: boolean; data?: Account } | null;
  if (!accountWrap?.success || !accountWrap.data) throw new AuthError('TapTap 获取账号信息失败');
  const account = accountWrap.data;

  // 3) LeanCloud 建/登用户（X-LC-Id + X-LC-Key，无 MD5）
  const authData = {
    authData: {
      taptap: {
        kid: token.kid,
        access_token: token.kid,
        token_type: 'mac',
        mac_key: token.mac_key,
        mac_algorithm: 'hmac-sha-1',
        openid: account.openid,
        unionid: account.unionid,
      },
    },
  };
  const lcRes = await fetchUpstream(
    `${config.leancloudBaseUrl.replace(/\/$/, '')}/users`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': LEANCLOUD_USER_AGENT,
        'X-LC-Id': config.leancloudAppId,
        'X-LC-Key': config.leancloudAppKey,
      },
      body: JSON.stringify(authData),
    },
    UPSTREAM_TIMEOUT_MS,
  );
  if (!lcRes.ok) throw new AuthError(`LeanCloud 认证失败: HTTP ${lcRes.status}`);
  const lcUser = (await lcRes.json().catch(() => null)) as { sessionToken?: unknown } | null;
  if (!lcUser || typeof lcUser.sessionToken !== 'string' || !lcUser.sessionToken) {
    throw new NetworkError('LeanCloud 未返回 sessionToken');
  }
  return lcUser.sessionToken;
}

/** 错误 → 状态码 + 错误码 + 文案（对应后端 handler 里的分类）。 */
export function classifyError(err: unknown): { errorCode: string; message: string } {
  if (err instanceof AuthPendingError) return { errorCode: 'INTERNAL_ERROR', message: '服务器内部错误' };
  if (err instanceof AuthError) return { errorCode: 'UNAUTHORIZED', message: '认证失败' };
  if (err instanceof TimeoutError) return { errorCode: 'UPSTREAM_TIMEOUT', message: '上游超时' };
  if (err instanceof NetworkError) return { errorCode: 'UPSTREAM_ERROR', message: '上游网络错误' };
  return { errorCode: 'INTERNAL_ERROR', message: '服务器内部错误' };
}
