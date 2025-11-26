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
