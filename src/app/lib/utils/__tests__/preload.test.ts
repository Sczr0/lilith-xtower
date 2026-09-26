import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearPrefetchCache,
  getPreloadPolicy,
  prefetchLeaderboard,
  prefetchRksData,
  resolvePreloadProfile,
} from '../preload';
import { LeaderboardAPI } from '../../api/leaderboard';
import { ScoreAPI, resetScoreApiCacheForTest } from '../../api/score';

describe('preload profile strategy', () => {
  it('returns off when user enables reduced data preference', () => {
    expect(resolvePreloadProfile({ saveData: true })).toBe('off');
    expect(resolvePreloadProfile({ prefersReducedData: true })).toBe('off');
  });

  it('returns off on weak network or low-end device', () => {
    expect(resolvePreloadProfile({ effectiveType: '2g' })).toBe('off');
    expect(resolvePreloadProfile({ downlink: 1.2 })).toBe('off');
    expect(resolvePreloadProfile({ rtt: 900 })).toBe('off');
    expect(resolvePreloadProfile({ deviceMemory: 2, hardwareConcurrency: 8 })).toBe('off');
    expect(resolvePreloadProfile({ deviceMemory: 8, hardwareConcurrency: 2 })).toBe('off');
  });

  it('returns aggressive on strong network with capable device', () => {
    const profile = resolvePreloadProfile({
      effectiveType: '4g',
      downlink: 20,
      rtt: 60,
      deviceMemory: 16,
      hardwareConcurrency: 12,
    });

    expect(profile).toBe('aggressive');
  });

  it('returns conservative on medium network/device constraints', () => {
    expect(resolvePreloadProfile({ effectiveType: '3g', downlink: 5, rtt: 100 })).toBe('conservative');
    expect(resolvePreloadProfile({ effectiveType: '4g', downlink: 2.5, rtt: 180 })).toBe('conservative');
    expect(resolvePreloadProfile({ effectiveType: '4g', downlink: 10, rtt: 100, deviceMemory: 4, hardwareConcurrency: 8 })).toBe('conservative');
  });

  it('returns balanced by default', () => {
    const profile = resolvePreloadProfile({
      effectiveType: '4g',
      downlink: 5,
      rtt: 200,
      deviceMemory: 8,
      hardwareConcurrency: 8,
    });

    expect(profile).toBe('balanced');
  });
});

describe('preload policy mapping', () => {
  it('maps aggressive policy to faster and broader strategy', () => {
    const policy = getPreloadPolicy('aggressive');

    expect(policy.profile).toBe('aggressive');
    expect(policy.homeIdleTimeout).toBeLessThan(1_000);
    expect(policy.dashboardStage4Delay).toBeLessThan(2_000);
    expect(policy.imageDefaultConcurrent).toBe(5);
    expect(policy.sponsorsImmediateConcurrent).toBe(4);
    expect(policy.homePublicRoutes).toContain('/sponsors');
  });

  it('maps conservative policy to slower and narrower strategy', () => {
    const policy = getPreloadPolicy('conservative');

    expect(policy.profile).toBe('conservative');
    expect(policy.homeIdleTimeout).toBeGreaterThanOrEqual(3_000);
    expect(policy.dashboardRoutes).toEqual(['/about', '/qa', '/sponsors']);
    expect(policy.sponsorsDeferredConcurrent).toBe(1);
  });
});

/**
 * 回归：预取必须与组件首次加载落在同一层缓存。
 * 历史上两者各发一次请求（LeaderboardPanel 带 offset=0、预取不带；RKS 预取结果
 * 除了「已预取」标记外无人消费），等于白跑一次上游。
 */
describe('预取结果可被组件复用', () => {
  const stubFastDeviceEnv = () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', {
      hardwareConcurrency: 8,
      deviceMemory: 8,
      connection: { effectiveType: '4g', downlink: 10, rtt: 40 },
    });
  };

  const stubJsonFetch = (payload: unknown) => {
    const fetchMock = vi.fn(async () =>
      ({
        ok: true,
        async json() {
          return payload;
        },
      }) as unknown as Response,
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    clearPrefetchCache();
    resetScoreApiCacheForTest();
  });

  it('prefetchLeaderboard 与排行榜首屏共用一次请求', async () => {
    stubFastDeviceEnv();
    const fetchMock = stubJsonFetch({ items: [], total: 0 });
    const limit = 200; // 用独立 limit 与其它用例的缓存 key 隔离

    await prefetchLeaderboard(limit);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await LeaderboardAPI.getTop({ limit, offset: 0 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('prefetchRksData 与 RKS 列表首次加载共用一次请求', async () => {
    stubFastDeviceEnv();
    const fetchMock = stubJsonFetch({ save: { gameRecord: {} } });

    await prefetchRksData();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await ScoreAPI.getRksList();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('RKS 列表显式刷新会绕过缓存重新请求', async () => {
    stubFastDeviceEnv();
    const fetchMock = stubJsonFetch({ save: { gameRecord: {} } });

    await ScoreAPI.getRksList();
    await ScoreAPI.getRksList({ force: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

