import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnifiedAPI } from '../unified';

const createFetchTextMock = (body: string, status = 200) =>
  vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => {
    return {
      ok: status >= 200 && status < 300,
      status,
      async text() {
        return body;
      },
    } as Response;
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('UnifiedAPI', () => {
  it('bind() posts JSON and parses response', async () => {
    const apiResponse = { message: '绑定成功', data: { internal_id: '123', haveApiToken: 1 } };
    const mockFetch = createFetchTextMock(JSON.stringify(apiResponse), 200);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await UnifiedAPI.bind({
      platform: 'OneBotv11',
      platform_id: '42',
      token: 'pgr_token',
      isGlobal: false,
    });

    expect(result).toEqual(apiResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0]?.[0])).toBe('/api/unified/bind');
    expect(mockFetch.mock.calls[0]?.[1]?.method).toBe('POST');
    expect(mockFetch.mock.calls[0]?.[1]?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(mockFetch.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ platform: 'OneBotv11', platform_id: '42', token: 'pgr_token', isGlobal: false }),
    );
  });

  it('throws upstream error message when response is not ok', async () => {
    const mockFetch = createFetchTextMock(JSON.stringify({ error: 'Token is invalid' }), 403);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(() =>
      UnifiedAPI.bind({ platform: 'OneBotv11', platform_id: '42', token: 'pgr_token' }),
    ).rejects.toThrow('Token is invalid');
  });

  it('request() does not send body for GET', async () => {
    const mockFetch = createFetchTextMock(JSON.stringify({ ok: true }), 200);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await UnifiedAPI.request('/test', undefined, 'GET');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0]?.[0])).toBe('/api/unified/test');
    expect(mockFetch.mock.calls[0]?.[1]?.method).toBe('GET');
    expect(mockFetch.mock.calls[0]?.[1]?.body).toBeUndefined();
  });

  it('searchPlayerIdList() posts JSON and parses response', async () => {
    const apiResponse = { data: [{ apiId: '1934128044', playerId: 'Lilith' }] };
    const mockFetch = createFetchTextMock(JSON.stringify(apiResponse), 200);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await UnifiedAPI.searchPlayerIdList({ playerId: 'Lilith', maxLength: 20 });

    expect(result).toEqual(apiResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0]?.[0])).toBe('/api/unified/get/playerIdList');
    expect(mockFetch.mock.calls[0]?.[1]?.method).toBe('POST');
    expect(mockFetch.mock.calls[0]?.[1]?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(mockFetch.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ playerId: 'Lilith', maxLength: 20 }));
  });

  it('getRanklistByRank() posts JSON to correct endpoint', async () => {
    const apiResponse = { data: { totDataNum: 1, users: [], me: null } };
    const mockFetch = createFetchTextMock(JSON.stringify(apiResponse), 200);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await UnifiedAPI.getRanklistByRank({ request_rank: 1 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0]?.[0])).toBe('/api/unified/get/ranklist/rank');
    expect(mockFetch.mock.calls[0]?.[1]?.method).toBe('POST');
    expect(mockFetch.mock.calls[0]?.[1]?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(mockFetch.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ request_rank: 1 }));
  });

  it('getRanklistByUser() posts JSON to correct endpoint', async () => {
    const apiResponse = { data: { totDataNum: 1, users: [], me: null } };
    const mockFetch = createFetchTextMock(JSON.stringify(apiResponse), 200);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await UnifiedAPI.getRanklistByUser({
      token: 'pgr_token',
      api_user_id: '123',
      api_token: 'pgrTk',
      platform: 'PhigrosQuery',
      platform_id: 'site_user_id',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0]?.[0])).toBe('/api/unified/get/ranklist/user');
    expect(mockFetch.mock.calls[0]?.[1]?.method).toBe('POST');
    expect(mockFetch.mock.calls[0]?.[1]?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(mockFetch.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({
        token: 'pgr_token',
        api_user_id: '123',
        api_token: 'pgrTk',
        platform: 'PhigrosQuery',
        platform_id: 'site_user_id',
      }),
    );
  });

  it('getScoreListByUser() posts JSON to correct endpoint', async () => {
    const apiResponse = { data: { totDataNum: 1, userRank: 1, users: [] } };
    const mockFetch = createFetchTextMock(JSON.stringify(apiResponse), 200);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await UnifiedAPI.getScoreListByUser({
      token: 'pgr_token',
      api_user_id: '123',
      api_token: 'pgrTk',
      platform: 'PhigrosQuery',
      platform_id: 'site_user_id',
      songId: '光.姜米條.0',
      rank: 'IN',
      orderBy: 'acc',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0]?.[0])).toBe('/api/unified/get/scoreList/user');
    expect(mockFetch.mock.calls[0]?.[1]?.method).toBe('POST');
    expect(mockFetch.mock.calls[0]?.[1]?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(mockFetch.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({
        token: 'pgr_token',
        api_user_id: '123',
        api_token: 'pgrTk',
        platform: 'PhigrosQuery',
        platform_id: 'site_user_id',
        songId: '光.姜米條.0',
        rank: 'IN',
        orderBy: 'acc',
      }),
    );
  });
});
