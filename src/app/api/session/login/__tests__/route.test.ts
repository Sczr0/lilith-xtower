import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    mockBuildAuthRequestBody.mockReset();
    mockGetAuthSession.mockReset();
    mockEnsureAuthSessionKey.mockReset();
    mockGetSeekendApiBaseUrl.mockReset();
    mockExchangeBackendToken.mockReset();

    mockBuildAuthRequestBody.mockReturnValue({} as never);
    mockGetSeekendApiBaseUrl.mockReturnValue('https://upstream.example');
    mockExchangeBackendToken.mockResolvedValue({ accessToken: 'backend-token', expiresIn: 3600 });
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
  });

  it('passes through 403 FORBIDDEN with code for global-ban detection', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ code: 'FORBIDDEN', detail: '管理员自定义封禁文案' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const request = {
      json: vi.fn().mockResolvedValue({
        credential: { type: 'session', token: 'token', timestamp: Date.now() },
        taptapVersion: 'cn',
      }),
    };

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
    expect(body.detail).toBe('管理员自定义封禁文案');
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
      json: vi.fn().mockResolvedValue({
        credential: { type: 'session', token: 'token', timestamp: Date.now() },
        taptapVersion: 'cn',
      }),
    };

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBeUndefined();
    expect(body.message).toBe('用户已被全局封禁');
  });
});
