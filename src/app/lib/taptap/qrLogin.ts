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
    deviceCodeEndpoint: 'https://www.taptap.com/oauth2/v1/device/code',
    tokenEndpoint: 'https://www.taptap.cn/oauth2/v1/token',
    userInfoEndpoint: 'https://open.tapapis.cn/account/basic-info/v1',
    leancloudBaseUrl: 'https://rak3ffdi.cloud.tds1.tapapis.cn/1.1',
    leancloudAppId: 'rAK3FfdieFob2Nn8Am',
    leancloudAppKey: 'Qr9AEqtuoSVS3zeD6iVbM4ZC0AtkJcQ89tywVyi0',
    clientId: 'rAK3FfdieFob2Nn8Am',
  },
  global: {
    deviceCodeEndpoint: 'https://www.taptap.io/oauth2/v1/device/code',
    tokenEndpoint: 'https://www.taptap.io/oauth2/v1/token',
    userInfoEndpoint: 'https://open.tapapis.io/account/basic-info/v1',
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
    const text = await res.text();
    throw new Error(text || `请求失败: ${res.status}`);
  }
  return (await res.json()) as T;
};

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
  };
}

export async function pollTapTapToken(
  version: TapTapVersion,
  deviceCode: string,
  deviceId: string,
  intervalMs: number,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<TokenResponse> {
  const config = TAP_CONFIG[version];
  const start = Date.now();

  while (true) {
    if (signal?.aborted) throw new DOMException('轮询已取消', 'AbortError');

    if (USE_PROXY) {
      const res = await proxyFetch<{ status: 'pending' | 'waiting' | 'denied' | 'ok'; token?: TokenResponse; msg?: string }>(
        'poll_token',
        { version, deviceCode, deviceId },
        signal,
      );
      if (res.status === 'ok' && res.token) return res.token;
      if (res.status === 'denied') throw new Error(res.msg || '用户取消或拒绝授权');
      // pending/waiting -> continue
    } else {
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
      const json = await res.json().catch(() => ({}));
      if (json?.success === true && json?.data) return json.data as TokenResponse;
      const err = json?.data?.error;
      if (err === 'access_denied') throw new Error('用户取消或拒绝授权');
      if (err !== 'authorization_pending' && err !== 'authorization_waiting') {
        throw new Error(json?.data?.msg || '获取授权状态失败');
      }
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error('扫描超时，请重新获取二维码');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export async function fetchTapTapProfile(
  version: TapTapVersion,
  token: TokenResponse,
): Promise<TapTapProfile> {
  if (!token.access_token) throw new Error('缺少 access_token，无法获取用户信息');

  if (USE_PROXY) {
    return proxyFetch<TapTapProfile>('profile', { version, token });
  }

  const config = TAP_CONFIG[version];
  const hasPublicProfile = token.scope?.includes('public_profile') ?? false;
  const baseProfileUrl = hasPublicProfile
    ? config.userInfoEndpoint.replace('basic-info', 'profile')
    : config.userInfoEndpoint;
  const url = new URL(baseProfileUrl);
  url.searchParams.set('client_id', config.clientId);

  const auth = await generateMacHeader(token, 'GET', url);
  const res = await fetch(url.toString(), { headers: { Authorization: auth } });
  if (!res.ok) throw new Error(`获取用户资料失败: ${res.status}`);
  return (await res.json()) as TapTapProfile;
}

export async function loginLeanCloudWithTapTap(
  version: TapTapVersion,
  profile: TapTapProfile,
  token: TokenResponse,
): Promise<string> {
  const openid =
    (profile as any)?.data?.openid ??
    (profile as any)?.openid ??
    (profile as any)?.id;
  const unionid =
    (profile as any)?.data?.unionid ?? (profile as any)?.unionid ?? undefined;

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

  if (USE_PROXY) {
    const res = await proxyFetch<{ sessionToken: string }>('leancloud', {
      version,
      authPayload,
    });
    if (!res.sessionToken) throw new Error('LeanCloud 未返回 sessionToken');
    return res.sessionToken;
  }

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

  if (USE_PROXY) {
    const res = await proxyFetch<{ sessionToken: string; profile: TapTapProfile; token: TokenResponse }>(
      'complete',
      {
        version,
        deviceCode: qr.deviceCode,
        deviceId: qr.deviceId,
        interval: qr.interval * 1000,
        timeoutMs,
      },
      options?.signal,
    );
    return res;
  }

  const token = await pollTapTapToken(
    version,
    qr.deviceCode,
    qr.deviceId,
    qr.interval * 1000,
    timeoutMs,
    options?.signal,
  );
  const profile = await fetchTapTapProfile(version, token);
  const sessionToken = await loginLeanCloudWithTapTap(version, profile, token);
  return { sessionToken, profile, token };
}
