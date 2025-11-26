import { TapTapVersion } from '../types/auth';

type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_url: string;
  qrcode_url: string;
  interval?: number;
  expires_in?: number;
};

type TokenResponse = {
  token?: string;
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  kid?: string;
  mac_key?: string;
  mac_algorithm?: string;
};

// TapTap用户资料类型
type TapTapProfileData = {
  id: string;
  name: string;
  avatar: string;
  bio?: string;
  gender?: string;
  birthday?: string;
  region?: string;
  verified: boolean;
  // 更多字段根据实际API响应添加
};

// 与后端集成的认证数据类型
type LCCombinedAuthData = {
  profile: TapTapProfileData;
  token: TokenResponse;
};

const CN_CLIENT_ID = 'rAK3FfdieFob2Nn8Am';
const GLOBAL_CLIENT_ID = 'kviehleldgxsagpozb';
const TAPSDK_VERSION = '2.1';

const endpoints = (version: TapTapVersion) => ({
  codeUrl:
    version === 'global'
      ? 'https://accounts.tapapis.com/oauth2/v1/device/code'
      : 'https://accounts.tapapis.cn/oauth2/v1/device/code',
  tokenUrl:
    version === 'global'
      ? 'https://accounts.tapapis.com/oauth2/v1/token'
      : 'https://accounts.tapapis.cn/oauth2/v1/token',
  profileUrl:
    version === 'global'
      ? 'https://open.tapapis.com/account/profile/v1'
      : 'https://open.tapapis.cn/account/profile/v1',
  clientId: version === 'global' ? GLOBAL_CLIENT_ID : CN_CLIENT_ID,
});

const generateDeviceId = () => {
  const rand = Math.random().toString(16).slice(2, 8);
  return `web-${Date.now()}-${rand}`;
};

const toFormBody = (data: Record<string, string | number>) =>
  Object.entries(data)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

/**
 * 生成MAC签名认证头
 */
const generateMacSignature = async (
  kid: string,
  macKey: string,
  macAlgorithm: string,
  method: string,
  uri: string,
  host: string,
  port: string,
  timestamp: number
): Promise<string> => {
  const nonce = Math.floor(Math.random() * 1000000).toString();
  const normalizedString = `${timestamp}\n${nonce}\n${method}\n${uri}\n${host}\n${port}\n\n`;

  const encoder = new TextEncoder();
  const key = encoder.encode(macKey);
  const data = encoder.encode(normalizedString);

  let hash: ArrayBuffer;
  if (macAlgorithm === 'hmac-sha-256') {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    hash = await crypto.subtle.sign('HMAC', cryptoKey, data);
  } else if (macAlgorithm === 'hmac-sha-1') {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    hash = await crypto.subtle.sign('HMAC', cryptoKey, data);
  } else {
    throw new Error(`Unsupported MAC algorithm: ${macAlgorithm}`);
  }

  const hashArray = Array.from(new Uint8Array(hash));
  const macValue = btoa(String.fromCharCode.apply(null, hashArray));

  return `id="${kid}",ts="${timestamp}",nonce="${nonce}",mac="${macValue}"`;
};

export const requestDeviceCode = async (
  version: TapTapVersion,
): Promise<{ deviceCode: string; userCode: string; qrcodeUrl: string; verificationUrl: string; interval: number; deviceId: string }> => {
  const { codeUrl, clientId } = endpoints(version);
  const deviceId = generateDeviceId();

  const body = toFormBody({
    client_id: clientId,
    response_type: 'device_code',
    scope: 'public_profile',
    version: TAPSDK_VERSION,
    platform: 'unity',
    info: JSON.stringify({ device_id: deviceId }),
  });

  const res = await fetch(codeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const json = await res.json();
  if (!res.ok || !json?.data?.device_code) {
    throw new Error(json?.data?.msg || '获取设备码失败');
  }

  const data = json.data as DeviceCodeResponse;
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    qrcodeUrl: data.qrcode_url,
    verificationUrl: data.verification_url,
    interval: data.interval ?? 1,
    deviceId,
  };
};

export const pollDeviceToken = async (
  version: TapTapVersion,
  deviceCode: string,
  deviceId: string,
  intervalMs: number,
  timeoutMs: number,
): Promise<TokenResponse> => {
  const { tokenUrl, clientId } = endpoints(version);
  const start = Date.now();

  while (true) {
    const body = toFormBody({
      grant_type: 'device_token',
      client_id: clientId,
      secret_type: 'hmac-sha-1',
      code: deviceCode,
      version: '1.0',
      platform: 'unity',
      info: JSON.stringify({ device_id: deviceId }),
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const json = await res.json();
    const success = json?.success === true;

    if (success && json?.data) {
      return json.data as TokenResponse;
    }

    const err = json?.data?.error;
    if (err === 'authorization_pending' || err === 'authorization_waiting') {
      // continue polling
    } else if (err === 'access_denied') {
      throw new Error('用户取消或拒绝授权');
    } else {
      const msg = json?.data?.msg || '未知错误';
      throw new Error(msg);
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error('扫码超时，请重试');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
};

/**
 * 使用TapTap Access Token获取用户资料
 */
export const getTapTapProfile = async (
  version: TapTapVersion,
  accessToken: string,
  kid: string,
  macKey: string,
  macAlgorithm: string,
): Promise<TapTapProfileData> => {
  const { profileUrl, clientId } = endpoints(version);
  const url = `${profileUrl}?client_id=${clientId}`;
  
  // 生成MAC签名
  const timestamp = Math.floor(Date.now() / 1000);
  const authorizationHeader = await generateMacSignature(
    kid,
    macKey,
    macAlgorithm,
    'GET',
    '/account/profile/v1',
    profileUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    '443',
    timestamp
  );

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `MAC ${authorizationHeader}`,
    },
  });

  if (!res.ok) {
    throw new Error(`获取用户资料失败: ${res.status}`);
  }

  const data = await res.json();
  return data as TapTapProfileData;
};

/**
 * 将TapTap认证数据与后端服务集成，获取session token
 */
export const loginWithTapTapData = async (
  version: TapTapVersion,
  profileData: TapTapProfileData,
  tokenData: TokenResponse,
): Promise<string> => {
  // 构建LeanCloud认证数据格式
  const lcAuthData = {
    taptap: {
      profile: profileData,
      token: {
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in,
        token_type: tokenData.token_type,
        scope: tokenData.scope,
        kid: tokenData.kid,
        mac_key: tokenData.mac_key,
        mac_algorithm: tokenData.mac_algorithm,
      }
    }
  };

  // 调用后端API进行登录
  const res = await fetch('/api/auth/taptap-login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      authData: lcAuthData,
      version: version
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `后端登录失败: ${res.status}`);
  }

  const data = await res.json();
  
  if (!data.sessionToken) {
    throw new Error('后端未返回session token');
  }

  return data.sessionToken;
};

/**
 * 完整的TapTap扫码登录流程
 */
export const completeTapTapLogin = async (
  version: TapTapVersion,
  deviceCode: string,
  deviceId: string,
  intervalMs: number,
  timeoutMs: number,
): Promise<{ sessionToken: string; profileData: TapTapProfileData }> => {
  // 步骤1：轮询获取TapTap Access Token
  const tokenData = await pollDeviceToken(
    version,
    deviceCode,
    deviceId,
    intervalMs,
    timeoutMs,
  );

  if (!tokenData.access_token || !tokenData.kid || !tokenData.mac_key || !tokenData.mac_algorithm) {
    throw new Error('TapTap token数据不完整');
  }

  // 步骤2：使用Access Token获取用户资料
  const profileData = await getTapTapProfile(
    version,
    tokenData.access_token,
    tokenData.kid,
    tokenData.mac_key,
    tokenData.mac_algorithm,
  );

  // 步骤3：将TapTap数据与后端服务集成，获取session token
  const sessionToken = await loginWithTapTapData(version, profileData, tokenData);

  return {
    sessionToken,
    profileData,
  };
};
