import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const UPSTREAM = 'https://mock-upstream.test';

const createRequest = () =>
  ({
    headers: new Headers({ accept: 'application/json' }),
    nextUrl: new URL('http://localhost/api/stats/summary?days=7'),
  }) as unknown as NextRequest;

const routeContext = (path: string[]) => ({ params: Promise.resolve({ path }) });

const jsonResponse = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  vi.resetModules();
  process.env.UNIFIED_API_BASE_URL = UPSTREAM;
});

afterEach(() => {
  delete process.env.UNIFIED_API_BASE_URL;
  vi.restoreAllMocks();
});

describe('GET /api/stats/[...path]', () => {
  it('透传上游 2xx，下发成功缓存头并保留查询串', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => jsonResponse('{"ok":true}'),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { GET } = await import('../route');
    const res = await GET(createRequest(), routeContext(['summary']));

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${UPSTREAM}/api/v1/stats/summary?days=7`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=60, stale-while-revalidate=30');
    await expect(res.text()).resolves.toBe('{"ok":true}');
  });

  it('上游 5xx 透传状态且不缓存', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse('{"error":"boom"}', 503),
    ) as unknown as typeof fetch;

    const { GET } = await import('../route');
    const res = await GET(createRequest(), routeContext(['summary']));

    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store, no-cache');
    await expect(res.text()).resolves.toBe('{"error":"boom"}');
  });

  it('上游 body 读取超时返回 504（不再冒泡成 failed to pipe response）', async () => {
    globalThis.fetch = vi.fn(async () => ({
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      arrayBuffer: async () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      },
    })) as unknown as typeof fetch;

    const { GET } = await import('../route');
    const res = await GET(createRequest(), routeContext(['summary']));

    expect(res.status).toBe(504);
    expect(res.headers.get('Cache-Control')).toBe('no-store, no-cache');
    await expect(res.json()).resolves.toEqual({ error: '统计API请求超时，请稍后重试' });
  });

  it('fetch 本身失败返回 502', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;

    const { GET } = await import('../route');
    const res = await GET(createRequest(), routeContext(['summary']));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: '统计API请求失败：fetch failed' });
  });
});
