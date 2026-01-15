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

const createReq = (host: string) =>
  ({
    headers: new Headers({ host }),
    nextUrl: new URL(`http://${host}/api/unified/test`),
  }) as unknown as NextRequest;

const createFetchOkMock = () =>
  vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => {
    return { ok: true } as Response;
  });

const createFetchFailMock = () =>
  vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => {
    throw new Error('connect ECONNREFUSED');
  });

let envSnapshot: EnvSnapshot;

beforeEach(() => {
  envSnapshot = snapshotEnv();
  vi.resetModules();
});

afterEach(() => {
  restoreEnv(envSnapshot);
  vi.restoreAllMocks();
});

describe('resolveUnifiedApiUpstreamBaseUrl', () => {
  it('uses built-in fallback when UNIFIED_API_BASE_URL is not set', async () => {
    delete process.env.UNIFIED_API_BASE_URL;
    delete process.env.UNIFIED_API_LOCAL_PROBE;

    const mockFetch = createFetchFailMock();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { resolveUnifiedApiUpstreamBaseUrl } = await import('../upstream');
    const baseUrl = await resolveUnifiedApiUpstreamBaseUrl(createReq('example.com'));

    expect(baseUrl).toBe('https://seekend.xtower.site');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns fallback without probing when host is not loopback and env is not forced', async () => {
    process.env.UNIFIED_API_BASE_URL = 'https://example.com/api/';
    delete process.env.UNIFIED_API_LOCAL_PROBE;

    const mockFetch = createFetchFailMock();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { resolveUnifiedApiUpstreamBaseUrl } = await import('../upstream');
    const baseUrl = await resolveUnifiedApiUpstreamBaseUrl(createReq('example.com'));

    expect(baseUrl).toBe('https://example.com/api');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('uses local baseUrl when loopback host and probe succeeds', async () => {
    process.env.UNIFIED_API_BASE_URL = 'https://example.com/api/';
    process.env.UNIFIED_API_LOCAL_BASE_URL = 'http://127.0.0.1:3930/';

    const mockFetch = createFetchOkMock();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { resolveUnifiedApiUpstreamBaseUrl } = await import('../upstream');
    const baseUrl = await resolveUnifiedApiUpstreamBaseUrl(createReq('localhost:3000'));

    expect(baseUrl).toBe('http://127.0.0.1:3930');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0]?.[0])).toBe('http://127.0.0.1:3930/');
    expect(mockFetch.mock.calls[0]?.[1]?.method).toBe('HEAD');
  });

  it('falls back when loopback host but probe fails', async () => {
    process.env.UNIFIED_API_BASE_URL = 'https://example.com/api';
    process.env.UNIFIED_API_LOCAL_BASE_URL = 'http://127.0.0.1:3930';

    const mockFetch = createFetchFailMock();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { resolveUnifiedApiUpstreamBaseUrl } = await import('../upstream');
    const baseUrl = await resolveUnifiedApiUpstreamBaseUrl(createReq('127.0.0.1:3000'));

    expect(baseUrl).toBe('https://example.com/api');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not probe when UNIFIED_API_LOCAL_PROBE=0 even on loopback host', async () => {
    process.env.UNIFIED_API_BASE_URL = 'https://example.com/api';
    process.env.UNIFIED_API_LOCAL_PROBE = '0';

    const mockFetch = createFetchOkMock();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { resolveUnifiedApiUpstreamBaseUrl } = await import('../upstream');
    const baseUrl = await resolveUnifiedApiUpstreamBaseUrl(createReq('localhost:3000'));

    expect(baseUrl).toBe('https://example.com/api');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('caches probe result within TTL to avoid repeated probing', async () => {
    process.env.UNIFIED_API_BASE_URL = 'https://example.com/api';
    process.env.UNIFIED_API_LOCAL_BASE_URL = 'http://127.0.0.1:3930';
    process.env.UNIFIED_API_LOCAL_PROBE_TTL_OK_MS = '60000';

    const mockFetch = createFetchOkMock();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { resolveUnifiedApiUpstreamBaseUrl } = await import('../upstream');
    const req = createReq('localhost:3000');

    const first = await resolveUnifiedApiUpstreamBaseUrl(req);
    const second = await resolveUnifiedApiUpstreamBaseUrl(req);

    expect(first).toBe('http://127.0.0.1:3930');
    expect(second).toBe('http://127.0.0.1:3930');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
