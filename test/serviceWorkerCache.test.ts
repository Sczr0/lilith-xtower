import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * public/sw.js 的单测。
 *
 * sw.js 不是模块、也不导出任何东西，所以这里把源码载入一个受控作用域
 * （注入 self / caches / fetch 桩），再取出内部的纯逻辑函数来验证：
 * - isProbablyCacheableResponse：可缓存判断是否对齐服务端的 no-store/private 语义
 * - isSrwApi：SWR 白名单是否已排除 /api/stats
 * - touchApiCache：高基数 API 缓存的 LRU 容量上限
 */

const SW_SOURCE = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://example.com';

function keyOf(input: Request | string): string {
  return typeof input === 'string' ? input : input.url;
}

type FakeCache = {
  store: Map<string, Response>;
  match(input: Request | string): Promise<Response | undefined>;
  put(input: Request | string, res: Response): Promise<void>;
  delete(input: Request | string): Promise<boolean>;
  keys(): Promise<Request[]>;
};

function createFakeCache(): FakeCache {
  const store = new Map<string, Response>();
  return {
    store,
    async match(input) {
      return store.get(keyOf(input));
    },
    async put(input, res) {
      store.set(keyOf(input), res);
    },
    async delete(input) {
      return store.delete(keyOf(input));
    },
    async keys() {
      return Array.from(store.keys(), (url) => new Request(url));
    },
  };
}

function createFakeCacheStorage(): { open(name: string): Promise<FakeCache> } {
  const cachesByName = new Map<string, FakeCache>();
  return {
    async open(name) {
      let cache = cachesByName.get(name);
      if (!cache) {
        cache = createFakeCache();
        cachesByName.set(name, cache);
      }
      return cache;
    },
  };
}

type SwInternals = {
  isProbablyCacheableResponse(res: Response): boolean;
  isSrwApi(url: URL): boolean;
  touchApiCache(cache: FakeCache, req: Request): Promise<void>;
  API_CACHE_MAX_ENTRIES: number;
  API_LRU_KEY: string;
  SWR_API_PATTERNS: RegExp[];
};

function loadServiceWorker(cachesStub: unknown = createFakeCacheStorage()): SwInternals {
  const selfStub = {
    location: { origin: ORIGIN },
    addEventListener: () => {},
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve(), matchAll: () => Promise.resolve([]) },
  };

  // sw.js 是 classic script（非模块），用 new Function 载入其源码即可拿到内部函数
  const factory = new Function(
    'self',
    'caches',
    'Request',
    'Response',
    'URL',
    'fetch',
    `${SW_SOURCE}\n;return { isProbablyCacheableResponse, isSrwApi, touchApiCache, API_CACHE_MAX_ENTRIES, API_LRU_KEY, SWR_API_PATTERNS };`,
  );

  return factory(
    selfStub,
    cachesStub,
    Request,
    Response,
    URL,
    () => Promise.reject(new Error('no network in test')),
  ) as SwInternals;
}

describe('sw.js 可缓存判断（对齐服务端缓存语义）', () => {
  const cacheable = (headers: Record<string, string>, status = 200) =>
    loadServiceWorker().isProbablyCacheableResponse(new Response('x', { status, headers }));

  it('public + s-maxage（CDN 缓存）仍可被 SW 缓存', () => {
    expect(cacheable({ 'Cache-Control': 'public, max-age=0, s-maxage=120, stale-while-revalidate=600' })).toBe(true);
    expect(cacheable({ 'Cache-Control': 'public, max-age=60, s-maxage=300' })).toBe(true);
  });

  it('no-store 影响下不缓存（服务端错误响应即为此种）', () => {
    expect(cacheable({ 'Cache-Control': 'no-store, no-cache' })).toBe(false);
    expect(cacheable({ 'Cache-Control': 'no-store' })).toBe(false);
  });

  it('private 一律不缓存（含大小写差异）', () => {
    expect(cacheable({ 'Cache-Control': 'PRIVATE, NO-STORE' })).toBe(false);
    expect(cacheable({ 'Cache-Control': 'private, max-age=30' })).toBe(false);
  });

  it('带 Set-Cookie 不缓存', () => {
    expect(cacheable({ 'Cache-Control': 'public, max-age=60', 'Set-Cookie': 'sid=1' })).toBe(false);
  });

  it('非 2xx 不缓存', () => {
    expect(cacheable({ 'Cache-Control': 'public, max-age=60' }, 500)).toBe(false);
    expect(cacheable({ 'Cache-Control': 'public, max-age=60' }, 404)).toBe(false);
  });
});

describe('sw.js SWR 白名单', () => {
  it('不包含 /api/stats（避免把统计结果展示成陈旧值）', () => {
    const sw = loadServiceWorker();
    expect(sw.isSrwApi(new URL(`${ORIGIN}/api/stats/summary`))).toBe(false);
    expect(sw.isSrwApi(new URL(`${ORIGIN}/api/stats/daily-dau`))).toBe(false);
    expect(sw.SWR_API_PATTERNS.some((re) => re.test('/api/stats/summary'))).toBe(false);
  });

  it('公开只读接口仍在白名单内', () => {
    const sw = loadServiceWorker();
    expect(sw.isSrwApi(new URL(`${ORIGIN}/api/qa`))).toBe(true);
    expect(sw.isSrwApi(new URL(`${ORIGIN}/api/songs`))).toBe(true);
    expect(sw.isSrwApi(new URL(`${ORIGIN}/api/public/profile/abc`))).toBe(true);
    expect(sw.isSrwApi(new URL(`${ORIGIN}/api/leaderboard/rks/top`))).toBe(true);
    expect(sw.isSrwApi(new URL(`${ORIGIN}/api/content/announcements`))).toBe(true);
  });

  it('带凭据 / 非白名单接口不被 SWR 拦截', () => {
    const sw = loadServiceWorker();
    expect(sw.isSrwApi(new URL(`${ORIGIN}/api/save`))).toBe(false);
    expect(sw.isSrwApi(new URL(`${ORIGIN}/api/session/validate`))).toBe(false);
    expect(sw.isSrwApi(new URL(`${ORIGIN}/api/unified/anything`))).toBe(false);
    // 跨域不拦截
    expect(sw.isSrwApi(new URL('https://other.example/api/qa'))).toBe(false);
  });
});

describe('sw.js API 缓存容量上限（LRU）', () => {
  it('上限与服务端 publicProxyCache 对齐（300）', () => {
    expect(loadServiceWorker().API_CACHE_MAX_ENTRIES).toBe(300);
  });

  it('超过上限时淘汰最久未使用的条目，条目数不超过上限', async () => {
    const storage = createFakeCacheStorage();
    const sw = loadServiceWorker(storage);
    const cache = await storage.open('lilith-api-test');
    const max = sw.API_CACHE_MAX_ENTRIES;

    for (let i = 0; i < max + 3; i += 1) {
      const req = new Request(`${ORIGIN}/api/public/profile/u${i}`);
      await cache.put(req, new Response('x'));
      await sw.touchApiCache(cache, req);
    }

    const keys = await cache.keys();
    const dataEntries = keys.filter((r) => !r.url.includes(sw.API_LRU_KEY));
    // 元数据条目额外占一条，数据条目不超过上限
    expect(dataEntries.length).toBe(max);

    // 最早写入的 3 条已被淘汰，第 4 条仍在
    expect(await cache.match(new Request(`${ORIGIN}/api/public/profile/u0`))).toBeUndefined();
    expect(await cache.match(new Request(`${ORIGIN}/api/public/profile/u2`))).toBeUndefined();
    expect(await cache.match(new Request(`${ORIGIN}/api/public/profile/u3`))).toBeDefined();
  });

  it('重复访问会把条目移到最近使用端，从而不被优先淘汰', async () => {
    const storage = createFakeCacheStorage();
    const sw = loadServiceWorker(storage);
    const cache = await storage.open('lilith-api-test');
    const max = sw.API_CACHE_MAX_ENTRIES;

    const hot = new Request(`${ORIGIN}/api/public/profile/hot`);
    await cache.put(hot, new Response('x'));
    await sw.touchApiCache(cache, hot);

    for (let i = 0; i < max - 1; i += 1) {
      const req = new Request(`${ORIGIN}/api/public/profile/c${i}`);
      await cache.put(req, new Response('x'));
      await sw.touchApiCache(cache, req);
    }

    // 重新访问 hot（移到最近使用端），再写入一条触发淘汰
    await sw.touchApiCache(cache, hot);
    const extra = new Request(`${ORIGIN}/api/public/profile/extra`);
    await cache.put(extra, new Response('x'));
    await sw.touchApiCache(cache, extra);

    expect(await cache.match(hot)).toBeDefined();
    expect(await cache.match(new Request(`${ORIGIN}/api/public/profile/c0`))).toBeUndefined();
  });
});
