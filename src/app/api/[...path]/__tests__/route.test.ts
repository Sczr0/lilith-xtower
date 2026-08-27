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
});