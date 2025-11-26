import { TapTapVersion } from '../types/auth';
import { SessionCredential } from '../types/auth';

// =================== 来自test.txt的TapTap认证逻辑 ===================

// 常量定义
const TAPSDK_VERSION = '2.1';

// TapTap客户端ID
const CN_TAPTAP_CLIENT_ID = 'rAK3FfdieFob2Nn8Am';
const GLOBAL_TAPTAP_CLIENT_ID = 'kviehleldgxsagpozb';

// LeanCloud密钥
const CN_LEANCLOUD_APP_KEY = 'Qr9AEqtuoSVS3zeD6iVbM4ZC0AtkJcQ89tywVyi0';
const CN_LEANCLOUD_CLIENT_ID = 'rAK3FfdieFob2Nn8Am';
const GLOBAL_LEANCLOUD_APP_KEY = 'tG9CTm0LDD736k9HMM9lBZrbeBGRmUkjSfNLDNib';
const GLOBAL_LEANCLOUD_CLIENT_ID = 'kviehleldgxsagpozb';

// 端点配置
const endpoints = (version: TapTapVersion) => ({
  // TapTap API端点
  codeUrl: version === 'global'
    ? 'https://www.taptap.io/oauth2/v1/device/code'
    : 'https://www.taptap.com/oauth2/v1/device/code',
  tokenUrl: version === 'global'
    ? 'https://www.taptap.io/oauth2/v1/token'
    : 'https://www.taptap.cn/oauth2/v1/token',
  profileUrl: version === 'global'
    ? 'https://open.tapapis.io/account/basic-info/v1'
    : 'https://open.tapapis.cn/account/basic-info/v1',
  taptapClientId: version === 'global' ? GLOBAL_TAPTAP_CLIENT_ID : CN_TAPTAP_CLIENT_ID,
  
  // LeanCloud端点（使用用户提供的实际地址）
  leanCloudServer: version === 'global'
    ? 'https://kviehlel.cloud.ap-sg.tapapis.com'
    : 'https://rak3ffdi.cloud.tds1.tapapis.cn',
  leanCloudAppKey: version === 'global' ? GLOBAL_LEANCLOUD_APP_KEY : CN_LEANCLOUD_APP_KEY,
  leanCloudClientId: version === 'global' ? GLOBAL_LEANCLOUD_CLIENT_ID : CN_LEANCLOUD_CLIENT_ID,
});

// 设备ID生成
const generateDeviceId = () => {
  const rand = Math.floor(Math.random() * 114514).toString();
  return `web-${Date.now()}-${rand}`;
};

// 编码辅助
const toFormBody = (data: Record<string, string | number>) =>
  Object.entries(data)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

// =================== TapTap认证实现 ===================

// 设备码响应类型
type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_url: string;
  qrcode_url: string;
  interval?: number;
  expires_in?: number;
};

// Token响应类型
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
};

// 请求设备码
export const requestDeviceCode = async (
  version: TapTapVersion,
): Promise<{ deviceCode: string; userCode: string; qrcodeUrl: string; verificationUrl: string; interval: number; deviceId: string }> => {
  const { codeUrl, taptapClientId } = endpoints(version);
  const deviceId = generateDeviceId();

  const body = toFormBody({
    client_id: taptapClientId,
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

// 轮询设备token
export const pollDeviceToken = async (
  version: TapTapVersion,
  deviceCode: string,
  deviceId: string,
  intervalMs: number,
  timeoutMs: number,
): Promise<TokenResponse> => {
  const { tokenUrl, taptapClientId } = endpoints(version);
  const start = Date.now();

  while (true) {
    const body = toFormBody({
      grant_type: 'device_token',
      client_id: taptapClientId,
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

// 生成MAC签名
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

// 获取TapTap用户资料
export const getTapTapProfile = async (
  version: TapTapVersion,
  accessToken: string,
  kid: string,
  macKey: string,
  macAlgorithm: string,
): Promise<TapTapProfileData> => {
  const { profileUrl, taptapClientId } = endpoints(version);
  const url = `${profileUrl}?client_id=${taptapClientId}`;
  
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

// =================== 来自test2.txt的LeanCloud集成实现 ===================

// LeanCloud响应类型
type LeanCloudUserResponse = {
  objectId: string;
  sessionToken: string;
  createdAt: string;
  updatedAt: string;
};

// LeanCloud认证数据格式
type LCCombinedAuthData = {
  profile: TapTapProfileData;
  token: TokenResponse;
};

// 生成LeanCloud MD5签名
const generateLeanCloudSignature = async (timestamp: number, appKey: string): Promise<string> => {
  const data = `${timestamp}${appKey}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('MD5', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hashHex},${timestamp}`;
};

// 与LeanCloud集成登录
export const loginWithLeanCloud = async (
  version: TapTapVersion,
  taptapData: LCCombinedAuthData,
): Promise<string> => {
  const { leanCloudServer, leanCloudAppKey, leanCloudClientId } = endpoints(version);
  
  // 构建LeanCloud认证数据
  const authData = {
    authData: {
      taptap: taptapData
    }
  };

  const timestamp = Date.now();
  const sign = await generateLeanCloudSignature(timestamp, leanCloudAppKey);

  const res = await fetch(`${leanCloudServer}/1.1/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LC-Id': leanCloudClientId,
      'X-LC-Sign': sign,
    },
    body: JSON.stringify(authData),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`LeanCloud登录失败: ${res.status} - ${errorText}`);
  }

  const userData = await res.json() as LeanCloudUserResponse;
  
  if (!userData.sessionToken) {
    throw new Error('LeanCloud未返回sessionToken');
  }

  return userData.sessionToken;
};

// =================== 完全解耦的扫码登录流程 ===================

/**
 * 完全解耦的TapTap扫码登录
 * 直接与TapTap API和LeanCloud服务交互，不依赖后端API
 */
export const standaloneTapTapLogin = async (
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

  // 步骤3：与LeanCloud服务直接集成，获取sessionToken
  const sessionToken = await loginWithLeanCloud(
    version,
    {
      profile: profileData,
      token: tokenData,
    }
  );

  return {
    sessionToken,
    profileData,
  };
};