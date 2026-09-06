/**
 * catch-all 代理（/api/[...path]）中"公开只读 GET"的服务端缓存层。
 *
 * 背景：排行榜 Top/按名次、公开档案、歌曲搜索都是无需会话的公开只读数据，
 * 此前每个访客都会穿透到上游（seekend）。这里按路径前缀匹配公开 GET，
 * 在源站内存中做带防击穿的短 TTL 缓存（复用 createDedupedCache），
 * 命中即可避免重复回源；响应侧配合 ETag/304 与 Cache-Control（见 route.ts）。
 *
 * 安全约束：
 * - 仅缓存不转发 Cookie 的匿名请求结果，响应不携带 Vary: Cookie；
 * - 仅缓存 2xx 响应，4xx/5xx 通过 UpstreamPassthroughError 原样透传、不缓存；
 * - 每条规则有 maxSize（LRU）上限，防止搜索词等高基数 key 撑爆内存。
 */
import 'server-only';

import { createDedupedCache } from '../utils/cacheWithDedup';

export type PublicProxyCacheRule = {
  /** 上游路径前缀（相对 /api/v1），如 'leaderboard/rks/top' */
  prefix: string;
  /** 源站内存缓存 TTL */
  ttlMs: number;
  /** LRU 容量上限 */
  maxSize: number;
  /**
   * 200/304 响应的 Cache-Control；需与 next.config.ts / edgeone.json 中
   * 对应路径的公开规则保持一致（同名头两条来源相同时才会去重为单值）。
   * 空串表示响应仍保持 private no-store（仅源站内存缓存，不进共享缓存）。
   */
  cacheControl: string;
};

// 与 next.config.ts 对应规则的头字符串保持逐字一致
const LEADERBOARD_CACHE_CONTROL = 'public, max-age=0, s-maxage=120, stale-while-revalidate=600';
const PROFILE_CACHE_CONTROL = 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600';

export const PUBLIC_PROXY_CACHE_RULES: PublicProxyCacheRule[] = [
  {
    prefix: 'leaderboard/rks/top',
    ttlMs: 120 * 1000,
    maxSize: 100,
    cacheControl: LEADERBOARD_CACHE_CONTROL,
  },
  {
    prefix: 'leaderboard/rks/by-rank',
    ttlMs: 120 * 1000,
    maxSize: 100,
    cacheControl: LEADERBOARD_CACHE_CONTROL,
  },
  {
    prefix: 'public/profile',
    ttlMs: 300 * 1000,
    maxSize: 300,
    cacheControl: PROFILE_CACHE_CONTROL,
  },
  {
    // 搜索词基数大且结果由上游实时判定：只做源站内存缓存，响应不进 CDN/浏览器共享缓存
    prefix: 'songs/search',
    ttlMs: 10 * 60 * 1000,
    maxSize: 500,
    cacheControl: '',
  },
];

export type PublicProxyCacheEntry = {
  status: number;
  contentType: string;
  body: string;
  etag: string;
};

/** 上游非 2xx 响应：不缓存，由调用方原样透传状态码与响应体 */
export class UpstreamPassthroughError extends Error {
  readonly status: number;
  readonly contentType: string;
  readonly body: string;

  constructor(status: number, contentType: string, body: string) {
    super(`upstream responded ${status}`);
    this.name = 'UpstreamPassthroughError';
    this.status = status;
    this.contentType = contentType;
    this.body = body;
  }
}

/** 按前缀边界匹配：'public/profile' 命中 'public/profile/x'，不命中 'public/profileX' */
export function matchPublicProxyCachePrefix(pathJoined: string, prefix: string): boolean {
  return pathJoined === prefix || pathJoined.startsWith(`${prefix}/`);
}

function createEntryCache(rule: PublicProxyCacheRule) {
  return createDedupedCache<PublicProxyCacheEntry>({ ttlMs: rule.ttlMs, maxSize: rule.maxSize });
}

export type PublicProxyCacheInstance = ReturnType<typeof createEntryCache>;

const RULE_CACHES: { rule: PublicProxyCacheRule; cache: PublicProxyCacheInstance }[] =
  PUBLIC_PROXY_CACHE_RULES.map((rule) => ({ rule, cache: createEntryCache(rule) }));

/**
 * 匹配"可源站缓存的公开只读 GET"。
 * 命中返回对应规则与缓存实例；未命中返回 null（走原有代理路径：转发 Cookie、no-store）。
 */
export function matchPublicGetCache(method: string, pathParts: string[]) {
  if (method !== 'GET') return null;

  const pathJoined = pathParts.filter(Boolean).join('/').toLowerCase();
  if (!pathJoined) return null;

  return RULE_CACHES.find(({ rule }) => matchPublicProxyCachePrefix(pathJoined, rule.prefix)) ?? null;
}

/** 主动清空全部公开代理缓存（供 purge 管理端点调用） */
export function clearPublicProxyCache(): void {
  for (const { cache } of RULE_CACHES) {
    cache.clear();
  }
}
