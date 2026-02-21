import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/lib/auth/authRequest', () => ({
  buildAuthRequestBody: vi.fn(),
}));

vi.mock('@/app/lib/auth/session', () => ({
  getAuthSession: vi.fn(),
}));

vi.mock('@/app/lib/auth/upstream', () => ({
  getSeekendApiBaseUrl: vi.fn(),
}));

import { buildAuthRequestBody } from '@/app/lib/auth/authRequest';
import { getAuthSession } from '@/app/lib/auth/session';
import { getSeekendApiBaseUrl } from '@/app/lib/auth/upstream';
import { POST } from '../route';

describe('api/session/validate', () => {
  const mockBuildAuthRequestBody = vi.mocked(buildAuthRequestBody);
  const mockGetAuthSession = vi.mocked(getAuthSession);
  const mockGetSeekendApiBaseUrl = vi.mocked(getSeekendApiBaseUrl);

  beforeEach(() => {
    mockBuildAuthRequestBody.mockReset();
    mockGetAuthSession.mockReset();
    mockGetSeekendApiBaseUrl.mockReset();

    mockBuildAuthRequestBody.mockReturnValue({} as never);
    mockGetSeekendApiBaseUrl.mockReturnValue('https://upstream.example');
  });

  it('returns 403 + FORBIDDEN when upstream indicates global ban', async () => {
    const destroy = vi.fn();
    mockGetAuthSession.mockResolvedValue({
      credential: { type: 'session', token: 'token', timestamp: Date.now() },
      taptapVersion: 'cn',
      destroy,
    } as never);
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ code: 'FORBIDDEN', detail: '管理员封禁文案' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
    expect(body.error).toBe('管理员封禁文案');
    expect(body.shouldLogout).toBe(true);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('does not treat detail text as global ban without FORBIDDEN code', async () => {
    const destroy = vi.fn();
    mockGetAuthSession.mockResolvedValue({
      credential: { type: 'session', token: 'token', timestamp: Date.now() },
      taptapVersion: 'cn',
      destroy,
    } as never);
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ detail: '用户已被全局封禁' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBeUndefined();
    expect(body.error).toBe('用户已被全局封禁');
    expect(body.shouldLogout).toBe(true);
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
