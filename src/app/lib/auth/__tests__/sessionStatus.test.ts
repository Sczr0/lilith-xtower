import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SessionStatusAuthoritativeError,
  SessionStatusTransientError,
  fetchSessionStatus,
  isTransientSessionStatusError,
} from '../sessionStatus';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const AUTHED_PAYLOAD = {
  isAuthenticated: true,
  credential: { type: 'api', api_user_id: 'u1', timestamp: 0 },
  taptapVersion: 'cn',
  consentRequired: false,
};

describe('fetchSessionStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('成功时直接返回负载', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(AUTHED_PAYLOAD));
    vi.stubGlobal('fetch', fetchMock);

    const payload = await fetchSessionStatus({ retryDelaysMs: [] });

    expect(payload.isAuthenticated).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('5xx 视为瞬时失败并做有限次重试', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: '会话校验失败' }, 502))
      .mockResolvedValueOnce(jsonResponse(AUTHED_PAYLOAD));
    vi.stubGlobal('fetch', fetchMock);

    const payload = await fetchSessionStatus({ retryDelaysMs: [0] });

    expect(payload.isAuthenticated).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('重试耗尽后抛出瞬时错误（而不是把它当成未登录）', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'boom' }, 503));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchSessionStatus({ retryDelaysMs: [0] })).rejects.toBeInstanceOf(
      SessionStatusTransientError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('网络错误视为瞬时失败并重试', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(AUTHED_PAYLOAD));
    vi.stubGlobal('fetch', fetchMock);

    const payload = await fetchSessionStatus({ retryDelaysMs: [0] });

    expect(payload.isAuthenticated).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('超时视为瞬时失败（不会一直挂住）', async () => {
    const fetchMock = vi.fn().mockImplementation((_input: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = fetchSessionStatus({ timeoutMs: 10, retryDelaysMs: [] });

    await expect(result).rejects.toBeInstanceOf(SessionStatusTransientError);
    await expect(result).rejects.toMatchObject({ message: '获取会话状态超时' });
  });

  it('4xx 是权威判定：不重试并抛权威错误', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: '未登录' }, 401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchSessionStatus({ retryDelaysMs: [0, 0] })).rejects.toBeInstanceOf(
      SessionStatusAuthoritativeError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('isTransientSessionStatusError 只认瞬时错误', () => {
    expect(isTransientSessionStatusError(new SessionStatusTransientError('x'))).toBe(true);
    expect(isTransientSessionStatusError(new SessionStatusAuthoritativeError('x', 401))).toBe(false);
    expect(isTransientSessionStatusError(new Error('x'))).toBe(false);
  });
});
