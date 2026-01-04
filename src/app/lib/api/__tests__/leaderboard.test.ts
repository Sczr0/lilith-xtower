import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeaderboardAPI } from '../leaderboard';
import type { LeaderboardTopResponse } from '../../types/leaderboard';

const createFetchMock = (payload: unknown, ok = true) =>
  vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () =>
    ({
      ok,
      async json() {
        return payload;
      },
    }) as Response,
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LeaderboardAPI.getTop', () => {
  it('defaults lite=true to reduce response payload', async () => {
    const apiResponse: LeaderboardTopResponse = { items: [], total: 0 };
    const mockFetch = createFetchMock(apiResponse);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await LeaderboardAPI.getTop({ limit: 10 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0]?.[0])).toBe('/api/leaderboard/rks/top?limit=10&lite=true');
  });

  it('allows disabling lite via params.lite=false', async () => {
    const apiResponse: LeaderboardTopResponse = { items: [], total: 0 };
    const mockFetch = createFetchMock(apiResponse);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await LeaderboardAPI.getTop({ limit: 11, lite: false });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0]?.[0])).toBe('/api/leaderboard/rks/top?limit=11');
  });
});
