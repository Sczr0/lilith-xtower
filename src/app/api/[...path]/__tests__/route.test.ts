import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

type EnvSnapshot = Record<string, string | undefined>;

const snapshotEnv = (): EnvSnapshot => ({ ...process.env });

const restoreEnv = (snapshot: EnvSnapshot) => {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(snapshot)) {
    if (typeof value === 'undefined') delete process.env[key];
    else process.env[key] = value;
  }
};

const createGetRequest = (search: string) =>
  ({
    method: 'GET',
    headers: new Headers({ accept: 'application/json' }),
    nextUrl: new URL(`http://localhost/api/songs/search${search}`),
  }) as unknown as NextRequest;

const routeContext = (path: string[]) => ({ params: Promise.resolve({ path }) });

let envSnapshot: EnvSnapshot;

beforeEach(() => {
  envSnapshot = snapshotEnv();
  vi.resetModules();
  delete process.env.API_PROXY_ALLOWED_PREFIXES;
  process.env.UNIFIED_API_BASE_URL = 'https://mock-upstream.test';
});

afterEach(() => {
  restoreEnv(envSnapshot);
  vi.restoreAllMocks();
});

describe('catch-all API proxy route', () => {
  it('allows /api/songs/search and forwards query to the upstream /api/v1/songs/search', async () => {
    const upstreamPayload = JSON.stringify({ id: 'Spasmodic.xxx', name: 'Spasmodic' });
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(upstreamPayload, { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { GET } = await import('../route');
    const res = await GET(createGetRequest('?q=Spasmodic&unique=true'), routeContext(['songs', 'search']));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toBe('https://mock-upstream.test/api/v1/songs/search?q=Spasmodic&unique=true');

    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toBe(upstreamPayload);
  });

  it('passes through the upstream 409 (multiple matches) response body', async () => {
    const conflictPayload = JSON.stringify({
      status: 409,
      code: 'SEARCH_NOT_UNIQUE',
      candidates: [{ id: 'a.1', name: 'A' }],
    });
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(conflictPayload, { status: 409, headers: { 'Content-Type': 'application/problem+json' } }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { GET } = await import('../route');
    const res = await GET(createGetRequest('?q=a&unique=true'), routeContext(['songs', 'search']));

    expect(res.status).toBe(409);
    const resBody = (await res.json()) as { status?: number; candidates?: unknown[] };
    expect(resBody.status).toBe(409);
    expect(Array.isArray(resBody.candidates)).toBe(true);
  });

  it('returns 404 without touching upstream for prefixes outside the whitelist', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response('unexpected', { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { GET } = await import('../route');
    const res = await GET(createGetRequest('?x=1'), routeContext(['admin', 'secret']));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toBe(404);
  });

  it('forwards upstream cookies but strips site-owned cookies from the request', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response('ok', { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const request = {
      method: 'GET',
      headers: new Headers({
        accept: 'application/json',
        cookie: 'phigros_auth_session=sealed; upstream_sid=keep-me; theme=dark',
      }),
      nextUrl: new URL('http://localhost/api/auth/session/ping'),
    } as unknown as NextRequest;

    const { GET } = await import('../route');
    const res = await GET(request, routeContext(['auth', 'session', 'ping']));

    expect(res.status).toBe(200);
    const init = fetchMock.mock.calls[0]?.[1];
    const forwardedHeaders = init?.headers as Record<string, string>;
    // 站内会话 Cookie 不外发上游，其余 Cookie 原样保留
    expect(forwardedHeaders.Cookie).toBe('upstream_sid=keep-me; theme=dark');
  });

  it('does not send a Cookie header when only site-owned cookies are present', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response('ok', { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const request = {
      method: 'GET',
      headers: new Headers({
        accept: 'application/json',
        cookie: 'phigros_auth_session=sealed; phigros_debug_auth=1',
      }),
      nextUrl: new URL('http://localhost/api/auth/session/ping'),
    } as unknown as NextRequest;

    const { GET } = await import('../route');
    await GET(request, routeContext(['auth', 'session', 'ping']));

    const init = fetchMock.mock.calls[0]?.[1];
    const forwardedHeaders = init?.headers as Record<string, string>;
    expect(forwardedHeaders.Cookie).toBeUndefined();
  });

  it('drops upstream Set-Cookie colliding with site-owned names and strips Domain', async () => {
    const upstreamResponse = new Response('{}', { status: 200 });
    upstreamResponse.headers.append('set-cookie', 'phigros_auth_session=forged; Path=/; HttpOnly');
    upstreamResponse.headers.append('set-cookie', 'upstream_sid=abc; Domain=xtower.site; Path=/');
    upstreamResponse.headers.append('set-cookie', 'tracker=xyz; Path=/');
    globalThis.fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => upstreamResponse,
    ) as unknown as typeof fetch;

    const request = {
      method: 'GET',
      headers: new Headers({ accept: 'application/json' }),
      nextUrl: new URL('http://localhost/api/auth/session/ping'),
    } as unknown as NextRequest;

    const { GET } = await import('../route');
    const res = await GET(request, routeContext(['auth', 'session', 'ping']));

    const setCookies = res.headers.getSetCookie();
    expect(setCookies).toHaveLength(2);
    expect(setCookies).toContain('upstream_sid=abc; Path=/');
    expect(setCookies).toContain('tracker=xyz; Path=/');
    expect(setCookies.some((value) => value.includes('phigros_auth_session'))).toBe(false);
    expect(setCookies.some((value) => value.toLowerCase().includes('domain='))).toBe(false);
  });
});