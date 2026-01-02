import { extractProblemMessage } from './problem';

const BASE_URL = '/api';

type CacheEntry = { value: string | null; ts: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

const readCache = (key: string): string | null | undefined => {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
};

const writeCache = (key: string, value: string | null) => {
  cache.set(key, { value, ts: Date.now() });
};

/**
 * 根据关键字查询歌曲，返回唯一谱面 ID（若存在）
 * @throws 当有多个匹配结果时抛错，消息包含候选列表
 */
export async function searchSongId(query: string): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;

  const cacheKey = q.toLowerCase();
  const cached = readCache(cacheKey);
  if (cached !== undefined) return cached;

  const params = new URLSearchParams({ q, unique: 'true' });
  const resp = await fetch(`${BASE_URL}/songs/search?${params.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (resp.status === 404) {
    writeCache(cacheKey, null);
    return null;
  }

  if (resp.status === 409) {
    const problem = (await resp.json().catch(() => null)) as unknown;
    throw new Error(extractProblemMessage(problem, '找到多个匹配的谱面，请使用更精确的关键词'));
  }

  if (!resp.ok) {
    const problem = (await resp.json().catch(() => null)) as unknown;
    throw new Error(extractProblemMessage(problem, `搜索失败 (${resp.status})`));
  }

  const data = (await resp.json()) as unknown;
  if (data && typeof data === 'object' && typeof (data as { id?: unknown }).id === 'string') {
    const id = (data as { id: string }).id;
    writeCache(cacheKey, id);
    return id;
  }

  writeCache(cacheKey, null);
  return null;
}
