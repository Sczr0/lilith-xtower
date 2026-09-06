import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/lib/auth/authRequest', () => ({
  buildAuthRequestBody: vi.fn(),
}));

vi.mock('@/app/lib/auth/credentialSummary', () => ({
  toCredentialSummary: vi.fn(),
}));

vi.mock('@/app/lib/auth/session', () => ({
  ensureAuthSessionKey: vi.fn(),
  getAuthSession: vi.fn(),
}));

vi.mock('@/app/lib/auth/upstream', () => ({
  getSeekendApiBaseUrl: vi.fn(),
}));

vi.mock('@/app/lib/auth/phi-session', () => ({
  exchangeBackendToken: vi.fn(),
}));

import { buildAuthRequestBody } from '@/app/lib/auth/authRequest';
import { ensureAuthSessionKey, getAuthSession } from '@/app/lib/auth/session';
import { exchangeBackendToken } from '@/app/lib/auth/phi-session';
import { getSeekendApiBaseUrl } from '@/app/lib/auth/upstream';
import { POST } from '../route';

describe('api/session/login', () => {
  const mockBuildAuthRequestBody = vi.mocked(buildAuthRequestBody);
  const mockGetAuthSession = vi.mocked(getAuthSession);
  const mockEnsureAuthSessionKey = vi.mocked(ensureAuthSessionKey);
  const mockGetSeekendApiBaseUrl = vi.mocked(getSeekendApiBaseUrl);
  const mockExchangeBackendToken = vi.mocked(exchangeBackendToken);

  beforeEach(() => {
    // 说明：CAP_SECRET_KEY 惰性读取；显式置空保证测试走「灰度跳过」分支，
    // 不受 CI/本地环境中可能存在的真实密钥影响。
    vi.stubEnv('CAP_SECRET_KEY', '');
    mockBuildAuthRequestBody.mockReset();
    mockGetAuthSession.mockReset();
    mockEnsureAuthSessionKey.mockReset();
    mockGetSeekendApiBaseUrl.mockReset();
    mockExchangeBackendToken.mockReset();

    mockBuildAuthRequestBody.mockReturnValue({} as never);
    mockGetSeekendApiBaseUrl.mockReturnValue('https://upstream.example');
    mockExchangeBackendToken.mockResolvedValue({ accessToken: 'backend-token', expiresIn: 3600, tokenType: 'Bearer' });
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('passes through 403 FORBIDDEN with code for global-ban detection', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ code: 'FORBIDDEN', detail: '管理员自定义封禁文案' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const request = {
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        credential: { type: 'session', token: 'token', timestamp: Date.now() },
        taptapVersion: 'cn',
      }),
    };

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
    // 说明：上游 detail 不再回显，仅透传受控错误码与固定文案
    expect(body.detail).toBeUndefined();
    expect(body.message).toBe('用户已被全局封禁');
    expect(mockGetAuthSession).not.toHaveBeenCalled();
  });

  it('does not treat 403 without FORBIDDEN code as global ban', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ detail: '用户已被全局封禁' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const request = {
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        credential: { type: 'session', token: 'token', timestamp: Date.now() },
        taptapVersion: 'cn',
      }),
    };

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBeUndefined();
    // 说明：上游 detail 不再回显，统一使用受控文案
    expect(body.message).toBe('登录凭证已过期或无效，请重新登录');
  });

  it('rejects login with 403 CAP_FAILED when secret is configured but capToken is missing', async () => {
    vi.stubEnv('CAP_SECRET_KEY', 'test-secret');
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const request = {
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        credential: { type: 'session', token: 'token', timestamp: Date.now() },
        taptapVersion: 'cn',
        // 注意：不携带 capToken —— 服务端配置密钥后必须拒绝
      }),
    };

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('CAP_FAILED');
    expect(body.success).toBe(false);
    // 拒绝发生在上游调用之前
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockGetAuthSession).not.toHaveBeenCalled();
  });
});
