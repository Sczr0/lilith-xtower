/**
 * 曲目信息数据源（somnia.xtower.site/info）— 服务端获取层。
 *
 * 上游文件：
 * - info.csv       曲目基础信息
 * - difficulty.csv 曲目定数
 * - version.txt    游戏版本
 *
 * 注意：上游要求请求头 Referer 包含 xtower.site；数据量约 300 行，
 * 采用服务端拉取 + 内存缓存 + 失败降级（保留上次成功数据）。
 *
 * 纯解析逻辑与类型位于 ./csv（可被 client 共享）；本模块包含 fetch 与
 * 缓存逻辑，仅限服务端使用。
 */
import 'server-only';

export * from './csv';
import { mergeSongInfo, type SongInfoData } from './csv';

const UPSTREAM_BASE = 'https://somnia.xtower.site/info';
const UPSTREAM_REFERER = 'https://xtower.site';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 小时
const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 上游响应上限（正常约 35KB）

// ── 服务端拉取 + 缓存 ──────────────────────────────────────────────

/** 缓存：成功数据 + 最近一次失败时间，用于失败降级。 */
type SongInfoCacheEntry = {
  data: SongInfoData | null;
  fetchedAt: number;
  failedAt: number | null;
  lastGood: SongInfoData | null;
};

const globalForInfo = globalThis as typeof globalThis & {
  __songInfoCache?: SongInfoCacheEntry;
};

function getCacheEntry(): SongInfoCacheEntry {
  if (!globalForInfo.__songInfoCache) {
    globalForInfo.__songInfoCache = { data: null, fetchedAt: 0, failedAt: null, lastGood: null };
  }
  return globalForInfo.__songInfoCache;
}

/** 缓存过期瞬间的 in-flight 去重，避免多请求同时打上游。 */
let inflightPromise: Promise<SongInfoData> | null = null;

async function fetchUpstreamFile(path: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${UPSTREAM_BASE}/${path}`, {
      headers: {
        Referer: UPSTREAM_REFERER,
        'User-Agent': 'PhigrosQuery/1.0 (+https://lilith.xtower.site)',
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`上游返回 ${response.status}`);
    }

    // 预检 Content-Length，拒绝异常超大响应
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_RESPONSE_BYTES) {
      throw new Error(`上游响应过大（${contentLength} bytes）`);
    }

    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      throw new Error(`上游响应过大（${text.length} bytes）`);
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 获取曲目信息（服务端）。
 * - 命中未过期缓存直接返回；
 * - 缓存过期时并发请求共享同一个 in-flight 拉取（防 stampede）；
 * - 上游失败时降级返回上次成功数据（并标记失败时间）；
 * - 无任何可用数据时抛错，由 API 层转为 502。
 */
export async function getSongInfoData(): Promise<SongInfoData> {
  const cache = getCacheEntry();
  const now = Date.now();

  if (cache.data && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = (async () => {
    const fetchStartedAt = Date.now();
    try {
      const [songCsv, difficultyCsv, versionText] = await Promise.all([
        fetchUpstreamFile('info.csv'),
        fetchUpstreamFile('difficulty.csv'),
        fetchUpstreamFile('version.txt'),
      ]);

      const data = mergeSongInfo(songCsv, difficultyCsv, versionText);
      cache.data = data;
      cache.lastGood = data;
      cache.fetchedAt = fetchStartedAt;
      cache.failedAt = null;
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      cache.failedAt = Date.now();
      // 上游失败时降级到上次成功数据
      if (cache.lastGood) {
        return cache.lastGood;
      }
      throw new Error(`获取曲目信息失败：${message}`);
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}
