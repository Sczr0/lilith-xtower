import { afterEach, describe, expect, it, vi } from 'vitest';

import { TAP_CONFIG } from '../src/config';
import { AuthError, AuthPendingError, NetworkError, pollForToken, requestDeviceCode } from '../src/tap';

const cn = TAP_CONFIG.cn;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

type Overrides = {
  device?: unknown;
  token?: unknown;
  userInfo?: unknown;
  leancloud?: unknown;
  deviceStatus?: number;
  tokenStatus?: number;
};

function installFetch(overrides: Overrides = {}) {
  const calls: Array<{ url: string; headers: Headers; body: string | undefined }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    calls.push({ url, headers: new Headers(init?.headers), body: init?.body as string | undefined });
    if (url.startsWith(cn.deviceCodeEndpoint)) {
      return jsonResponse(
        overrides.device ?? {
          success: true,
          data: {
            device_code: 'dc-1',
            user_code: 'uc-1',
            verification_url: 'https://accounts.taptap.cn/device',
            qrcode_url: 'https://accounts.taptap.cn/device?qrcode=1&user_code=uc-1',
            interval: 1,
            expires_in: 300,
          },
        },
        overrides.deviceStatus ?? 200,
      );
    }
    if (url.startsWith(cn.tokenEndpoint)) {
      return jsonResponse(
        overrides.token ?? { success: true, data: { kid: 'kid-1', mac_key: 'mac-1' } },
        overrides.tokenStatus ?? 200,
      );
    }
    if (url.startsWith(cn.userInfoEndpoint)) {
      return jsonResponse(overrides.userInfo ?? { success: true, data: { openid: 'open-1', unionid: 'union-1' } });
    }
    if (url.startsWith(cn.leancloudBaseUrl)) {
      return jsonResponse(overrides.leancloud ?? { sessionToken: 'r:session-token' });
    }
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestDeviceCode', () => {
  it('maps the upstream device-code payload', async () => {
    installFetch();
    const device = await requestDeviceCode(cn, 'device-1');
    expect(device).toMatchObject({ deviceCode: 'dc-1', userCode: 'uc-1', interval: 1, expiresIn: 300 });
  });

  it('throws AuthError on a business error', async () => {
    installFetch({ device: { success: false, data: { error: 'invalid_client', msg: 'bad client' } } });
    await expect(requestDeviceCode(cn, 'device-1')).rejects.toBeInstanceOf(AuthError);
  });

  it('treats a 5xx response as a transient network error, not an auth error', async () => {
    installFetch({ deviceStatus: 500, device: { success: false, data: { error: 'server_error' } } });
    await expect(requestDeviceCode(cn, 'device-1')).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('pollForToken', () => {
  it('returns the LeanCloud sessionToken and uses X-LC-Id/X-LC-Key (no MD5 sign)', async () => {
    const { calls } = installFetch();
    const sessionToken = await pollForToken(cn, 'dc-1', 'device-1');
    expect(sessionToken).toBe('r:session-token');

    const lc = calls.find((c) => c.url.startsWith(cn.leancloudBaseUrl));
    expect(lc).toBeTruthy();
    expect(lc!.headers.get('X-LC-Id')).toBe(cn.leancloudAppId);
    expect(lc!.headers.get('X-LC-Key')).toBe(cn.leancloudAppKey);
    expect(lc!.headers.get('X-LC-Sign')).toBeNull();

    // MAC 头用在 user_info 请求上
    const info = calls.find((c) => c.url.startsWith(cn.userInfoEndpoint));
    expect(info!.headers.get('Authorization')).toMatch(/^MAC id="kid-1",ts="\d+",nonce="\d+",mac=".+"$/);
  });

  it('throws AuthPendingError while the user has not authorized', async () => {
    installFetch({ token: { success: false, data: { error: 'authorization_pending', error_description: 'pending' } } });
    await expect(pollForToken(cn, 'dc-1', 'device-1')).rejects.toBeInstanceOf(AuthPendingError);
  });

  it('throws AuthError on an invalid grant', async () => {
    installFetch({ token: { success: false, data: { error: 'invalid_grant', error_description: 'expired' } } });
    await expect(pollForToken(cn, 'dc-1', 'device-1')).rejects.toBeInstanceOf(AuthError);
  });

  it('accepts a success-less 200 payload instead of misreading it as an error', async () => {
    installFetch({ token: { data: { kid: 'kid-1', mac_key: 'mac-1' } } });
    await expect(pollForToken(cn, 'dc-1', 'device-1')).resolves.toBe('r:session-token');
  });

  it('treats a 5xx token response as a transient network error even with an error body', async () => {
    installFetch({
      tokenStatus: 500,
      token: { success: false, data: { error: 'server_error', error_description: 'boom' } },
    });
    await expect(pollForToken(cn, 'dc-1', 'device-1')).rejects.toBeInstanceOf(NetworkError);
  });
});
