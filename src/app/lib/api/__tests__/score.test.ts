import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScoreAPI } from '../score';
import type { ServiceStatsResponse } from '../../types/score';

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

describe('ScoreAPI.getServiceStats', () => {
  it('parses stats summary into typed structure', async () => {
    const apiResponse = {
      timezone: 'Asia/Shanghai',
      config_start_at: null,
      first_event_at: '2025-01-01T00:00:00+08:00',
      last_event_at: '2025-10-28T04:58:51.514930657+08:00',
      features: [
        { feature: 'bestn', count: 185, last_at: '2025-10-28T01:56:12.549267147+08:00' },
        { feature: 'image_render', count: 100, last_at: '2025-10-28T01:56:10.000000000+08:00' },
        { feature: 'image_render', count: 28, last_at: '2025-10-28T02:00:00.000000000+08:00' },
        { feature: 'single_query', count: 13, last_at: null },
        { feature: 'unknown_feature', count: undefined, last_at: undefined },
      ],
      unique_users: {
        total: 34,
        by_kind: [
          ['session_token', 32],
          ['external_api_user_id', 1],
          ['platform_pair', '1'],
        ],
      },
    };

    const mockFetch = createFetchMock(apiResponse);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await ScoreAPI.getServiceStats();

    const expected: ServiceStatsResponse = {
      timezone: 'Asia/Shanghai',
      configStartAt: null,
      firstEventAt: '2025-01-01T00:00:00+08:00',
      lastEventAt: '2025-10-28T04:58:51.514930657+08:00',
      features: [
        { key: 'bestn', count: 185, lastUpdated: '2025-10-28T01:56:12.549267147+08:00' },
        { key: 'image_render', count: 128, lastUpdated: '2025-10-28T02:00:00.000000000+08:00' },
        { key: 'single_query', count: 13, lastUpdated: null },
        { key: 'unknown_feature', count: 0, lastUpdated: null },
      ],
      uniqueUsers: {
        total: 34,
        byKind: [
          ['session_token', 32],
          ['external_api_user_id', 1],
          ['platform_pair', 1],
        ],
      },
    };

    expect(result).toEqual(expected);
  });

  it('throws with upstream message when response is not ok', async () => {
    const errorPayload = { message: 'Upstream fetch failed' };
    const mockFetch = createFetchMock(errorPayload, false);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(() => ScoreAPI.getServiceStats()).rejects.toThrow('Upstream fetch failed');
  });
});
