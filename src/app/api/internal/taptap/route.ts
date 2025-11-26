import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { URL } from 'url';
import { TapTapVersion } from '@/app/lib/types/auth';
import { getTapConfig, TapTapProfile, QrCodeData } from '@/app/lib/taptap/qrLogin';

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  kid?: string;
  mac_key?: string;
  mac_algorithm?: string;
};

type Action = 'device_code' | 'poll_token' | 'profile' | 'leancloud' | 'complete';

type LeanCloudUserResponse = {
  sessionToken?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action: Action = body.action;
    const version: TapTapVersion = body.version || 'cn';
    const config = getTapConfig(version);

    if (action === 'device_code') {
      const data = await requestDeviceCodeServer(config);
      return NextResponse.json(data);
    }

    if (action === 'poll_token') {
      const data = await pollTokenOnceServer(config, body.deviceCode, body.deviceId);
      return NextResponse.json(data);
    }

    if (action === 'profile') {
      const data = await fetchProfileServer(config, body.token as TokenResponse);
      return NextResponse.json(data);
    }

    if (action === 'leancloud') {
      const sessionToken = await loginLeanCloudServer(config, body.profile as TapTapProfile, body.token as TokenResponse);
      return NextResponse.json({ sessionToken });
    }

    if (action === 'complete') {
      const data = await completeServer(config, body.deviceCode, body.deviceId, body.interval ?? 1000, body.timeoutMs ?? 120000);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function requestDeviceCodeServer(config: ReturnType<typeof getTapConfig>): Promise<QrCodeData> {
  const deviceId = `web-${Date.now()}-${Math.floor(Math.random() * 114514)}`;
  const form = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'device_code',
    scope: 'public_profile',
    version: '2.1',
    platform: 'unity',
    info: JSON.stringify({ device_id: deviceId }),
  });

  const res = await fetch(config.deviceCodeEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json?.data?.device_code) {
    throw new Error(json?.data?.msg || '获取设备码失败');
  }
  const data = json.data as any;
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

async function pollTokenOnceServer(
  config: ReturnType<typeof getTapConfig>,
  deviceCode: string,
  deviceId: string,
): Promise<{ status: 'pending' | 'waiting' | 'denied' | 'ok'; token?: TokenResponse; msg?: string }> {
  const form = new URLSearchParams({
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
    body: form.toString(),
  });
  const json: any = await res.json().catch(() => ({}));
  if (json?.success === true && json?.data) {
    return { status: 'ok', token: json.data as TokenResponse };
  }
  const err = json?.data?.error;
  if (err === 'authorization_pending') return { status: 'pending' };
  if (err === 'authorization_waiting') return { status: 'waiting' };
  if (err === 'access_denied') return { status: 'denied', msg: '用户取消或拒绝授权' };
  return { status: 'denied', msg: json?.data?.msg || '获取授权状态失败' };
}

async function completeServer(
  config: ReturnType<typeof getTapConfig>,
  deviceCode: string,
  deviceId: string,
  intervalMs: number,
  timeoutMs: number,
): Promise<{ sessionToken: string; profile: TapTapProfile; token: TokenResponse }> {
  const start = Date.now();
  let token: TokenResponse | undefined;
  while (true) {
    const once = await pollTokenOnceServer(config, deviceCode, deviceId);
    if (once.status === 'ok' && once.token) {
      token = once.token;
      break;
    }
    if (once.status === 'denied') {
      throw new Error(once.msg || '用户取消或拒绝授权');
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error('扫描超时，请重新获取二维码');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  const profile = await fetchProfileServer(config, token!);
  const sessionToken = await loginLeanCloudServer(config, profile, token!);
  return { sessionToken, profile, token: token! };
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
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: auth,
    },
  });
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

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LC-Id': config.leancloudAppId,
      'X-LC-Sign': sign,
    },
    body: JSON.stringify({ authData: { taptap: { profile, token } } }),
  });
  if (!res.ok) throw new Error(`LeanCloud 登录失败: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as LeanCloudUserResponse;
  if (!data.sessionToken) throw new Error('LeanCloud 未返回 sessionToken');
  return data.sessionToken;
}

function generateMacHeaderServer(token: TokenResponse, method: 'GET' | 'POST', url: URL) {
  const nonce = Math.floor(Math.random() * 1_000_000).toString();
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
