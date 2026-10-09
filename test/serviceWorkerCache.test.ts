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
 * - isCacheFirstCandidate / isManifestRequest：manifest 是否已脱离 cache-first
 * - isRscRequest / isRscPrefetchRequest / isRscPayloadResponse / rscCacheKey：
 *   App Router 软导航的识别、预取排除、载荷类型闸门与 _rsc 哈希剔除
 * - PUBLIC_PAGES：与 middleware.ts 的 PUBLIC_HTML_CACHE 双向一致（直接从源码解析）
 * - matchCachedNavigation：导航断网回退时的 pathname 忽略查询串匹配
 * - networkFirstRsc：写入闸门（公开页 / 非预取 / text/x-component / 非 private）与
 *   离线回退行为（无缓存返回网络错误，绝不回退 HTML 离线页）
 */

const SW_SOURCE = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const MIDDLEWARE_SOURCE = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8');
const ORIGIN = 'https://example.com';

/**
 * 从 middleware.ts 抽取 PUBLIC_HTML_CACHE 的键集合，用于和 sw.js 的 PUBLIC_PAGES
 * 做双向一致性断言，避免「中间件加了公开页、SW 忘了加」这类再次漂移。
 */
function middlewarePublicHtmlPaths(): Set<string> {
  const block = MIDDLEWARE_SOURCE.match(/const PUBLIC_HTML_CACHE[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error('PUBLIC_HTML_CACHE block not found in middleware.ts');
  const paths = new Set<string>();
  for (const match of block[1].matchAll(/^\s*'([^']+)':/gm)) paths.add(match[1]);
  return paths;
}

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

type RscReq = { headers: { get(name: string): string | null } };

type SwInternals = {
  isProbablyCacheableResponse(res: Response): boolean;
  isSrwApi(url: URL): boolean;
  touchApiCache(cache: FakeCache, req: Request): Promise<void>;
  isCacheFirstCandidate(url: URL): boolean;
  isManifestRequest(url: URL): boolean;
  isRscRequest(req: RscReq, url: URL): boolean;
  isRscPrefetchRequest(req: RscReq): boolean;
  isRscPayloadResponse(res: Response): boolean;
  rscCacheKey(url: URL): string;
  matchCachedNavigation(
    cache: { match(input: Request | string): Promise<Response | undefined> },
    req: RscReq,
    url: URL,
  ): Promise<Response | undefined>;
  networkFirstRsc(req: Request): Promise<Response>;
  PUBLIC_PAGES: Set<string>;
  RSC_CACHE: string;
  API_CACHE_MAX_ENTRIES: number;
  API_LRU_KEY: string;
  SWR_API_PATTERNS: RegExp[];
};

function loadServiceWorker(
  cachesStub: unknown = createFakeCacheStorage(),
  fetchStub: (req: Request) => Promise<Response> = () =>
    Promise.reject(new Error('no network in test')),
): SwInternals {
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
    `${SW_SOURCE}\n;return { isProbablyCacheableResponse, isSrwApi, touchApiCache, isCacheFirstCandidate, isManifestRequest, isRscRequest, isRscPrefetchRequest, isRscPayloadResponse, rscCacheKey, matchCachedNavigation, networkFirstRsc, PUBLIC_PAGES, RSC_CACHE, API_CACHE_MAX_ENTRIES, API_LRU_KEY, SWR_API_PATTERNS };`,
  );

  return factory(
    selfStub,
    cachesStub,
    Request,
    Response,
    URL,
    fetchStub,
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

describe('sw.js manifest 不再 cache-first', () => {
  it('manifest 走 network-first，其它静态资源仍 cache-first', () => {
    const sw = loadServiceWorker();
    expect(sw.isCacheFirstCandidate(new URL(`${ORIGIN}/manifest.webmanifest`))).toBe(false);
    expect(sw.isManifestRequest(new URL(`${ORIGIN}/manifest.webmanifest`))).toBe(true);
    // 回归保护：immutable 的构建产物不应被一起挪走
    expect(sw.isCacheFirstCandidate(new URL(`${ORIGIN}/_next/static/chunks/a.js`))).toBe(true);
    expect(sw.isCacheFirstCandidate(new URL(`${ORIGIN}/icons/icon-192.png`))).toBe(true);
    expect(sw.isManifestRequest(new URL(`${ORIGIN}/_next/static/chunks/a.js`))).toBe(false);
  });
});

describe('sw.js RSC 软导航识别与缓存键', () => {
  const noHeaders = { headers: { get: () => null } };
  const rscHeader = { headers: { get: (n: string) => (n === 'rsc' ? '1' : null) } };

  it('URL 带 _rsc 或请求头 rsc: 1 都识别为软导航', () => {
    const sw = loadServiceWorker();
    expect(sw.isRscRequest(noHeaders, new URL(`${ORIGIN}/songs?_rsc=abc`))).toBe(true);
    expect(sw.isRscRequest(rscHeader, new URL(`${ORIGIN}/songs`))).toBe(true);
    expect(sw.isRscRequest(noHeaders, new URL(`${ORIGIN}/songs`))).toBe(false);
  });

  it('整段/分段预取请求被识别（只走网络，不参与缓存）', () => {
    const sw = loadServiceWorker();
    expect(
      sw.isRscPrefetchRequest({ headers: { get: (n) => (n === 'next-router-prefetch' ? '1' : null) } }),
    ).toBe(true);
    expect(
      sw.isRscPrefetchRequest({
        headers: { get: (n) => (n === 'next-router-segment-prefetch' ? '/_tree' : null) },
      }),
    ).toBe(true);
    expect(sw.isRscPrefetchRequest(noHeaders)).toBe(false);
  });

  it('只有 text/x-component 才算 RSC 载荷', () => {
    const sw = loadServiceWorker();
    expect(
      sw.isRscPayloadResponse(
        new Response('x', { headers: { 'Content-Type': 'text/x-component; charset=utf-8' } }),
      ),
    ).toBe(true);
    expect(
      sw.isRscPayloadResponse(new Response('x', { headers: { 'Content-Type': 'text/html' } })),
    ).toBe(false);
  });

  it('缓存键剔除 _rsc 哈希、保留其它查询串（不同哈希共用一条）', () => {
    const sw = loadServiceWorker();
    expect(sw.rscCacheKey(new URL(`${ORIGIN}/songs?diff=IN&_rsc=abc`))).toBe(
      `${ORIGIN}/songs?diff=IN`,
    );
    expect(sw.rscCacheKey(new URL(`${ORIGIN}/songs?diff=IN&_rsc=xyz`))).toBe(
      sw.rscCacheKey(new URL(`${ORIGIN}/songs?diff=IN&_rsc=abc`)),
    );
  });
});

describe('sw.js 公开页白名单与中间件对齐', () => {
  it('与 middleware.ts 的 PUBLIC_HTML_CACHE 双向一致（防止再次漂移）', () => {
    const { PUBLIC_PAGES } = loadServiceWorker();
    const middlewarePaths = middlewarePublicHtmlPaths();
    expect(middlewarePaths.size).toBeGreaterThan(0);
    expect([...PUBLIC_PAGES].sort()).toEqual([...middlewarePaths].sort());
    // 个性化页面不得进入离线缓存
    expect(PUBLIC_PAGES.has('/dashboard')).toBe(false);
  });
});

describe('sw.js 导航缓存回退（忽略查询串）', () => {
  // 精确分支要按原 Request 的 URL 与请求头匹配（Cache API 会比对 Vary）
  const navReq = (url: string) => new Request(url, { headers: { 'accept-encoding': 'gzip' } });

  it('精确未命中时按 pathname 回退到已缓存页', async () => {
    const sw = loadServiceWorker();
    const store = new Map<string, Response>();
    store.set(`${ORIGIN}/songs`, new Response('cached-html'));
    const cache = {
      async match(input: Request | string) {
        return store.get(keyOf(input));
      },
    };

    const found = await sw.matchCachedNavigation(
      cache,
      navReq(`${ORIGIN}/songs?diff=IN`),
      new URL(`${ORIGIN}/songs?diff=IN`),
    );
    expect(found).toBeDefined();
    expect(await found!.text()).toBe('cached-html');

    // 完全没有缓存的页面不能误配
    expect(
      await sw.matchCachedNavigation(cache, navReq(`${ORIGIN}/about?x=1`), new URL(`${ORIGIN}/about?x=1`)),
    ).toBeUndefined();
  });

  it('带查询串的精确缓存优先于 pathname 回退', async () => {
    const sw = loadServiceWorker();
    const store = new Map<string, Response>();
    store.set(`${ORIGIN}/songs`, new Response('bare'));
    store.set(`${ORIGIN}/songs?diff=IN`, new Response('exact'));
    const cache = {
      async match(input: Request | string) {
        return store.get(keyOf(input));
      },
    };

    const found = await sw.matchCachedNavigation(
      cache,
      navReq(`${ORIGIN}/songs?diff=IN`),
      new URL(`${ORIGIN}/songs?diff=IN`),
    );
    expect(await found!.text()).toBe('exact');
  });
});

describe('sw.js RSC 缓存写入闸门（安全不变量）', () => {
  const rscRequest = (path: string, extra: Record<string, string> = {}) =>
    new Request(`${ORIGIN}${path}`, { headers: { rsc: '1', ...extra } });

  const rscResponse = (headers: Record<string, string>) =>
    new Response('flight', {
      status: 200,
      headers: { 'Content-Type': 'text/x-component', ...headers },
    });

  const cachedKeys = async (
    storage: ReturnType<typeof createFakeCacheStorage>,
    sw: SwInternals,
  ) => (await storage.open(sw.RSC_CACHE)).keys();

  it('公开页的可缓存完整载荷会写入', async () => {
    const storage = createFakeCacheStorage();
    const sw = loadServiceWorker(storage, async () =>
      rscResponse({ 'Cache-Control': 'public, max-age=0, s-maxage=600' }),
    );
    await sw.networkFirstRsc(rscRequest('/songs?_rsc=abc'));
    expect((await cachedKeys(storage, sw)).length).toBe(1);
  });

  it('带会话的 private/no-store 响应不写入（防跨用户泄漏）', async () => {
    const storage = createFakeCacheStorage();
    const sw = loadServiceWorker(storage, async () =>
      rscResponse({ 'Cache-Control': 'private, no-store, max-age=0' }),
    );
    await sw.networkFirstRsc(rscRequest('/songs?_rsc=abc'));
    expect((await cachedKeys(storage, sw)).length).toBe(0);
  });

  it('非公开页（/dashboard）不写入', async () => {
    const storage = createFakeCacheStorage();
    const sw = loadServiceWorker(storage, async () =>
      rscResponse({ 'Cache-Control': 'public, max-age=0, s-maxage=600' }),
    );
    await sw.networkFirstRsc(rscRequest('/dashboard?_rsc=abc'));
    expect((await cachedKeys(storage, sw)).length).toBe(0);
  });

  it('响应不是 text/x-component（如 HTML）不写入 RSC_CACHE', async () => {
    const storage = createFakeCacheStorage();
    const sw = loadServiceWorker(
      storage,
      async () =>
        new Response('<html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=60' },
        }),
    );
    await sw.networkFirstRsc(rscRequest('/songs?_rsc=abc'));
    expect((await cachedKeys(storage, sw)).length).toBe(0);
  });

  it('预取请求不读写缓存', async () => {
    const storage = createFakeCacheStorage();
    const sw = loadServiceWorker(storage, async () =>
      rscResponse({ 'Cache-Control': 'public, max-age=0, s-maxage=600' }),
    );
    await sw.networkFirstRsc(rscRequest('/songs?_rsc=abc', { 'next-router-prefetch': '1' }));
    expect((await cachedKeys(storage, sw)).length).toBe(0);
  });

  it('离线且无缓存时返回网络错误，绝不回退 HTML 离线页', async () => {
    const storage = createFakeCacheStorage();
    const sw = loadServiceWorker(storage); // fetch 默认 reject
    const res = await sw.networkFirstRsc(rscRequest('/songs?_rsc=abc'));
    expect(res.type).toBe('error');
    expect(res.status).toBe(0);
  });

  it('离线时按剔除 _rsc 哈希的键命中缓存（不同哈希也能回退）', async () => {
    const storage = createFakeCacheStorage();
    const onlineSw = loadServiceWorker(storage, async () =>
      rscResponse({ 'Cache-Control': 'public, max-age=0, s-maxage=600' }),
    );
    await onlineSw.networkFirstRsc(rscRequest('/songs?_rsc=abc'));

    const offlineSw = loadServiceWorker(storage);
    const res = await offlineSw.networkFirstRsc(rscRequest('/songs?_rsc=xyz'));
    expect(res.type).not.toBe('error');
    expect(await res.text()).toBe('flight');
  });
});
