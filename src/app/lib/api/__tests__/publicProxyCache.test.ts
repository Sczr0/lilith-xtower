import { describe, it, expect } from 'vitest';

import {
  clearPublicProxyCache,
  matchPublicGetCache,
  matchPublicProxyCachePrefix,
  UpstreamPassthroughError,
} from '../publicProxyCache';

describe('matchPublicGetCache', () => {
  it('仅匹配 GET 请求', () => {
    expect(matchPublicGetCache('POST', ['leaderboard', 'rks', 'top'])).toBeNull();
    expect(matchPublicGetCache('PUT', ['public', 'profile', 'x'])).toBeNull();
    expect(matchPublicGetCache('GET', ['leaderboard', 'rks', 'top'])).not.toBeNull();
  });

  it('命中排行榜 Top / 按名次，且 Cache-Control 与 next.config 逐字一致', () => {
    const top = matchPublicGetCache('GET', ['leaderboard', 'rks', 'top']);
    expect(top?.rule.cacheControl).toBe('public, max-age=0, s-maxage=120, stale-while-revalidate=600');

    const byRank = matchPublicGetCache('GET', ['leaderboard', 'rks', 'by-rank']);
    expect(byRank?.rule.cacheControl).toBe('public, max-age=0, s-maxage=120, stale-while-revalidate=600');
  });

  it('命中公开档案', () => {
    const hit = matchPublicGetCache('GET', ['public', 'profile', 'someAlias']);
    expect(hit?.rule.cacheControl).toBe('public, max-age=0, s-maxage=300, stale-while-revalidate=3600');
  });

  it('命中歌曲搜索，但响应保持 private no-store（空 cacheControl）', () => {
    const hit = matchPublicGetCache('GET', ['songs', 'search']);
    expect(hit).not.toBeNull();
    expect(hit?.rule.cacheControl).toBe('');
  });

  it('前缀边界匹配：不以完整路径段命中', () => {
    expect(matchPublicGetCache('GET', ['leaderboard', 'rks', 'topxyz'])).toBeNull();
    expect(matchPublicGetCache('GET', ['public', 'profileX'])).toBeNull();
    expect(matchPublicGetCache('GET', ['songs', 'searchx'])).toBeNull();
  });

  it('非公开路径（auth 等）不匹配', () => {
    expect(matchPublicGetCache('GET', ['auth', 'session'])).toBeNull();
    expect(matchPublicGetCache('GET', ['developer', 'keys'])).toBeNull();
    expect(matchPublicGetCache('GET', [])).toBeNull();
  });

  it('不同 key 共享同一规则缓存实例时互不干扰（key 含查询串）', async () => {
    const hit = matchPublicGetCache('GET', ['leaderboard', 'rks', 'top']);
    expect(hit).not.toBeNull();
    let calls = 0;
    const a = await hit!.cache.get('/api/leaderboard/rks/top?limit=10', async () => {
      calls += 1;
      return { status: 200, contentType: 'application/json', body: 'a', etag: 'x' };
    });
    const b = await hit!.cache.get('/api/leaderboard/rks/top?limit=20', async () => {
      calls += 1;
      return { status: 200, contentType: 'application/json', body: 'b', etag: 'y' };
    });
    expect(a.body).toBe('a');
    expect(b.body).toBe('b');
    expect(calls).toBe(2);
  });
});

describe('clearPublicProxyCache', () => {
  it('清空后相同 key 重新调用 fetcher', async () => {
    const hit = matchPublicGetCache('GET', ['public', 'profile', 'x']);
    expect(hit).not.toBeNull();
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return { status: 200, contentType: 'application/json', body: 'v', etag: 'e' };
    };

    await hit!.cache.get('k', fetcher);
    await hit!.cache.get('k', fetcher);
    expect(calls).toBe(1);

    clearPublicProxyCache();
    await hit!.cache.get('k', fetcher);
    expect(calls).toBe(2);
  });
});

describe('matchPublicProxyCachePrefix', () => {
  it('精确相等或完整路径段前缀命中', () => {
    expect(matchPublicProxyCachePrefix('public/profile', 'public/profile')).toBe(true);
    expect(matchPublicProxyCachePrefix('public/profile/x', 'public/profile')).toBe(true);
    expect(matchPublicProxyCachePrefix('public/profil', 'public/profile')).toBe(false);
    expect(matchPublicProxyCachePrefix('leaderboard/rks/top', 'leaderboard/rks/top')).toBe(true);
  });
});

describe('UpstreamPassthroughError', () => {
  it('携带上游状态码与响应体用于透传', () => {
    const err = new UpstreamPassthroughError(404, 'application/json', '{"error":"nf"}');
    expect(err.status).toBe(404);
    expect(err.body).toBe('{"error":"nf"}');
    expect(err instanceof Error).toBe(true);
  });
});
