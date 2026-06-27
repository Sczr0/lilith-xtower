import { extractProblemMessage } from './problem';
import { createDedupedCache } from '../utils/cacheWithDedup';

const BASE_URL = '/api';

const CACHE_TTL_MS = 10 * 60 * 1000;
const songCache = createDedupedCache<string | null>({ ttlMs: CACHE_TTL_MS });

export interface SongCandidate {
  id: string;
  name: string;
  artist?: string;
}

export class MultipleMatchesError extends Error {
  candidates: SongCandidate[];

  constructor(message: string, candidates: SongCandidate[]) {
    super(message);
    this.name = 'MultipleMatchesError';
    this.candidates = candidates;
  }
}

const parseSongCandidates = (payload: unknown): SongCandidate[] => {
  if (!payload || typeof payload !== 'object') return [];
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return [];

  return candidates
    .map((item): SongCandidate | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as { id?: unknown; name?: unknown; artist?: unknown };
      if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
      const out: SongCandidate = { id: raw.id, name: raw.name };
      if (typeof raw.artist === 'string') out.artist = raw.artist;
      return out;
    })
    .filter((it): it is SongCandidate => it !== null);
};

/**
 * 根据关键字查询歌曲，返回唯一谱面 ID（若存在）
 * @throws 当有多个匹配结果时抛错，消息包含候选列表
 */
export async function searchSongId(query: string): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;

  const cacheKey = q.toLowerCase();
  return songCache.get(cacheKey, async () => {
    const params = new URLSearchParams({ q, unique: 'true' });
    const resp = await fetch(`${BASE_URL}/songs/search?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (resp.status === 404) {
      return null;
    }

    if (resp.status === 409) {
      const problem = (await resp.json().catch(() => null)) as unknown;
      const candidates = parseSongCandidates(problem);
      const message = extractProblemMessage(problem, '找到多个匹配的谱面，请使用更精确的关键词');

      if (candidates.length > 0) {
        throw new MultipleMatchesError(message, candidates);
      }

      throw new Error(message);
    }

    if (!resp.ok) {
      const problem = (await resp.json().catch(() => null)) as unknown;
      throw new Error(extractProblemMessage(problem, `搜索失败 (${resp.status})`));
    }

    const data = (await resp.json()) as unknown;
    if (data && typeof data === 'object' && typeof (data as { id?: unknown }).id === 'string') {
      return (data as { id: string }).id;
    }

    return null;
  });
}
