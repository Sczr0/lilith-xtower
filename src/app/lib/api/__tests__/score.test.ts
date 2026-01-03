import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScoreAPI } from '../score';
import type { DailyDauResponse, DailyFeaturesResponse, DailyHttpResponse, ServiceStatsResponse } from '../../types/score';

const createFetchMock = (payload: unknown, ok = true) =>
  vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () =>
    ({
      ok,
      async json() {
        return payload;
      },
    }) as Response,
  );

const createFetchMockJsonError = (ok = true) =>
  vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () =>
    ({
      ok,
      async json() {
        throw new Error('invalid json');
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
      configStartAt: null,
      firstEventAt: '2025-01-01T00:00:00+08:00',
      lastEventAt: '2025-10-28T04:58:51.514930657+08:00',
      features: [
        { feature: 'bestn', count: 185, lastAt: '2025-10-28T01:56:12.549267147+08:00' },
        { feature: 'image_render', count: 100, lastAt: '2025-10-28T01:56:10.000000000+08:00' },
        { feature: 'image_render', count: 28, lastAt: '2025-10-28T02:00:00.000000000+08:00' },
        { feature: 'single_query', count: 13, lastAt: null },
        { feature: 'unknown_feature', count: undefined, lastAt: undefined },
      ],
      uniqueUsers: {
        total: 34,
        byKind: [
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

describe('ScoreAPI.getDailyDau', () => {
  it('parses daily dau response into typed structure', async () => {
    const apiResponse = {
      timezone: 'Asia/Shanghai',
      start: '2025-12-01',
      end: '2025-12-03',
      rows: [
        { date: '2025-12-01', activeUsers: '12', activeIps: 34 },
        { date: '2025-12-02', activeUsers: 10, activeIps: '20' },
      ],
    };

    const mockFetch = createFetchMock(apiResponse);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await ScoreAPI.getDailyDau({ start: '2025-12-01', end: '2025-12-03', timezone: 'Asia/Shanghai' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0]?.[0])).toBe('/api/stats/daily/dau?start=2025-12-01&end=2025-12-03&timezone=Asia%2FShanghai');

    const expected: DailyDauResponse = {
      timezone: 'Asia/Shanghai',
      start: '2025-12-01',
      end: '2025-12-03',
      rows: [
        { date: '2025-12-01', activeUsers: 12, activeIps: 34 },
        { date: '2025-12-02', activeUsers: 10, activeIps: 20 },
      ],
    };

    expect(result).toEqual(expected);
  });

  it('throws when response is not ok', async () => {
    const errorPayload = { message: 'Upstream fetch failed' };
    const mockFetch = createFetchMock(errorPayload, false);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(() => ScoreAPI.getDailyDau({ start: '2025-12-01', end: '2025-12-03' })).rejects.toThrow(
      'Upstream fetch failed',
    );
  });

  it('throws when json parsing fails', async () => {
    const mockFetch = createFetchMockJsonError(true);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(() => ScoreAPI.getDailyDau({ start: '2025-12-01', end: '2025-12-03' })).rejects.toThrow(
      '解析每日活跃数据响应失败',
    );
  });
});

describe('ScoreAPI.getDailyHttp', () => {
  it('parses daily http totals and routes', async () => {
    const apiResponse = {
      timezone: 'UTC',
      start: '2025-12-01',
      end: '2025-12-03',
      routeFilter: null,
      methodFilter: null,
      totals: [
        {
          date: '2025-12-01',
          total: 100,
          errors: '5',
          errorRate: 0.05,
          clientErrors: 3,
          serverErrors: 2,
          clientErrorRate: 0.03,
          serverErrorRate: 0.02,
        },
      ],
      routes: [
        {
          date: '2025-12-01',
          route: '/image/bn',
          method: 'GET',
          total: '80',
          errors: 4,
          errorRate: 0.05,
          clientErrors: 2,
          serverErrors: 2,
          clientErrorRate: 0.025,
          serverErrorRate: 0.025,
        },
      ],
    };

    const mockFetch = createFetchMock(apiResponse);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await ScoreAPI.getDailyHttp({ start: '2025-12-01', end: '2025-12-03', timezone: 'UTC' });

    expect(String(mockFetch.mock.calls[0]?.[0])).toBe('/api/stats/daily/http?start=2025-12-01&end=2025-12-03&timezone=UTC');

    const expected: DailyHttpResponse = {
      timezone: 'UTC',
      start: '2025-12-01',
      end: '2025-12-03',
      routeFilter: null,
      methodFilter: null,
      totals: [
        {
          date: '2025-12-01',
          total: 100,
          errors: 5,
          errorRate: 0.05,
          clientErrors: 3,
          serverErrors: 2,
          clientErrorRate: 0.03,
          serverErrorRate: 0.02,
        },
      ],
      routes: [
        {
          date: '2025-12-01',
          route: '/image/bn',
          method: 'GET',
          total: 80,
          errors: 4,
          errorRate: 0.05,
          clientErrors: 2,
          serverErrors: 2,
          clientErrorRate: 0.025,
          serverErrorRate: 0.025,
        },
      ],
    };

    expect(result).toEqual(expected);
  });

  it('throws when json parsing fails', async () => {
    const mockFetch = createFetchMockJsonError(true);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(() => ScoreAPI.getDailyHttp({ start: '2025-12-01', end: '2025-12-03' })).rejects.toThrow(
      '解析每日 HTTP 统计响应失败',
    );
  });
});

describe('ScoreAPI.getDailyFeatures', () => {
  it('parses daily features rows', async () => {
    const apiResponse = {
      timezone: 'UTC',
      start: '2025-12-01',
      end: '2025-12-03',
      featureFilter: null,
      rows: [
        { date: '2025-12-01', feature: 'bestn', count: '12', uniqueUsers: 5 },
        { date: '2025-12-02', feature: 'save', count: 20, uniqueUsers: '10' },
      ],
    };

    const mockFetch = createFetchMock(apiResponse);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await ScoreAPI.getDailyFeatures({ start: '2025-12-01', end: '2025-12-03', timezone: 'UTC' });

    expect(String(mockFetch.mock.calls[0]?.[0])).toBe('/api/stats/daily/features?start=2025-12-01&end=2025-12-03&timezone=UTC');

    const expected: DailyFeaturesResponse = {
      timezone: 'UTC',
      start: '2025-12-01',
      end: '2025-12-03',
      featureFilter: null,
      rows: [
        { date: '2025-12-01', feature: 'bestn', count: 12, uniqueUsers: 5 },
        { date: '2025-12-02', feature: 'save', count: 20, uniqueUsers: 10 },
      ],
    };

    expect(result).toEqual(expected);
  });
});
