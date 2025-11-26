import { TapTapVersion } from '../types/auth';

/**
 * TapTap / LeanCloud 扫码登录核心
 */

// TapTap SDK 版本号
const TAPSDK_VERSION = '2.1';

// 配置来源：test3.txt
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

// TapTap 设备码响应
type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_url: string;
  qrcode_url: string;
  interval?: number;
  expires_in?: number;
};

// TapTap token 响应
type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  kid?: string;
  mac_key?: string;
  mac_algorithm?: string;
};

// TapTap 用户资料
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

// LeanCloud 用户响应
type LeanCloudUserResponse = {
  sessionToken?: string;
};

// 封装好的二维码数据
export type QrCodeData = {
  deviceCode: string;
  userCode: string;
  qrcodeUrl: string;
  verificationUrl: string;
  interval: number;
  expiresIn: number;
  deviceId: string;
};

// 生成设备 ID（与 test.txt 相同思路）
const generateDeviceId = () => {
  const rand = Math.floor(Math.random() * 114514).toString();
  return `web-${Date.now()}-${rand}`;
};

// 表单编码
const toFormBody = (data: Record<string, string | number>) =>
  Object.entries(data)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

// TapTap 设备码请求
export async function requestTapTapDeviceCode(
  version: TapTapVersion,
  signal?: AbortSignal,
): Promise<QrCodeData> {
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
    const msg = json?.data?.msg || '获取二维码失败';
    throw new Error(msg);
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

// TapTap token 轮询
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
    if (signal?.aborted) {
      throw new DOMException('轮询已取消', 'AbortError');
    }

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
    const success = json?.success === true;

    if (success && json?.data) {
      return json.data as TokenResponse;
    }

    const err = json?.data?.error;
    if (err === 'authorization_pending' || err === 'authorization_waiting') {
      // 继续轮询
    } else if (err === 'access_denied') {
      throw new Error('用户取消或拒绝授权');
    } else {
      const msg = json?.data?.msg || '获取授权状态失败';
      throw new Error(msg);
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error('扫描超时，请重新获取二维码');
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// 生成 MAC 签名头
const generateMacHeader = async (
  token: TokenResponse,
  method: 'GET' | 'POST',
  url: URL,
) => {
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
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: hashName },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  const macValue = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return `MAC id="${token.kid}",ts="${timestamp}",nonce="${nonce}",mac="${macValue}"`;
};

// 获取 TapTap 用户资料
export async function fetchTapTapProfile(
  version: TapTapVersion,
  token: TokenResponse,
): Promise<TapTapProfile> {
  if (!token.access_token) {
    throw new Error('缺少 access_token，无法获取用户信息');
  }

  const config = TAP_CONFIG[version];
  const hasPublicProfile = token.scope?.includes('public_profile') ?? false;
  const baseProfileUrl = hasPublicProfile
    ? config.userInfoEndpoint.replace('basic-info', 'profile')
    : config.userInfoEndpoint;

  const url = new URL(baseProfileUrl);
  url.searchParams.set('client_id', config.clientId);

  const authorizationHeader = await generateMacHeader(token, 'GET', url);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: authorizationHeader,
    },
  });

  if (!res.ok) {
    throw new Error(`获取用户资料失败: ${res.status}`);
  }

  return (await res.json()) as TapTapProfile;
}

// 计算 LeanCloud 签名（MD5(timestamp + appKey)）
const generateLeanCloudSign = async (appKey: string) => {
  const timestamp = Date.now();
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('MD5', encoder.encode(`${timestamp}${appKey}`));
  const hashArray = Array.from(new Uint8Array(buffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hashHex},${timestamp}`;
};

// 直连 LeanCloud 登录
export async function loginLeanCloudWithTapTap(
  version: TapTapVersion,
  profile: TapTapProfile,
  token: TokenResponse,
): Promise<string> {
  const config = TAP_CONFIG[version];
  const sign = await generateLeanCloudSign(config.leancloudAppKey);
  const base = config.leancloudBaseUrl.replace(/\/$/, '');
  const url = base.endsWith('/1.1') ? `${base}/users` : `${base}/1.1/users`;

  const body = {
    authData: {
      taptap: {
        profile,
        token,
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LC-Id': config.leancloudAppId,
      'X-LC-Sign': sign,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LeanCloud 登录失败: ${res.status} ${text}`);
  }

  const data = (await res.json()) as LeanCloudUserResponse;
  if (!data.sessionToken) {
    throw new Error('LeanCloud 未返回 sessionToken');
  }

  return data.sessionToken;
}

// 完整扫码登录流程
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
  );

  const profile = await fetchTapTapProfile(version, token);
  const sessionToken = await loginLeanCloudWithTapTap(version, profile, token);

  return { sessionToken, profile, token };
}
