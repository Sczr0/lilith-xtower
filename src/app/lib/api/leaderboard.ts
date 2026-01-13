import { extractProblemMessage } from './problem';
import type {
  AliasUpdatePayload,
  LeaderboardMeResponse,
  LeaderboardQuery,
  LeaderboardTopResponse,
  PublicProfileResponse,
  RankQuery,
  UpdateProfileOptions,
} from '../types/leaderboard';

const BASE_URL = '/api';

type CacheEntry<T> = { value: T; ts: number };

const memoryCache = new Map<string, CacheEntry<unknown>>();
const TOP_CACHE_TTL_MS = 3 * 60 * 1000;
const PUBLIC_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

const readCache = <T>(key: string, ttlMs: number): T | null => {
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!cached) return null;
  if (Date.now() - cached.ts > ttlMs) {
    memoryCache.delete(key);
    return null;
  }
  return cached.value;
};

const writeCache = (key: string, value: unknown) => {
  memoryCache.set(key, { value, ts: Date.now() });
};

const clearCache = () => {
  memoryCache.clear();
};

const buildQueryString = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, `${value}`);
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

export class LeaderboardAPI {
  static async getTop(params: LeaderboardQuery = {}): Promise<LeaderboardTopResponse> {
    const liteEnabled = params.lite ?? true;
    const query = buildQueryString({
      limit: params.limit,
      offset: params.offset,
      lite: liteEnabled ? 'true' : undefined,
    });

    const cacheKey = `leaderboard:top:${query}`;
    const cached = readCache<LeaderboardTopResponse>(cacheKey, TOP_CACHE_TTL_MS);
    if (cached) return cached;

    const response = await fetch(`${BASE_URL}/leaderboard/rks/top${query}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(extractProblemMessage(payload, '获取排行榜数据失败'));
    }

    const data = (await response.json()) as LeaderboardTopResponse;
    writeCache(cacheKey, data);
    return data;
  }

  static async getByRank(params: RankQuery): Promise<LeaderboardTopResponse> {
    const query = buildQueryString({
      rank: params.rank,
      start: params.start,
      end: params.end,
      count: params.count,
    });

    const cacheKey = `leaderboard:by-rank:${query}`;
    const cached = readCache<LeaderboardTopResponse>(cacheKey, TOP_CACHE_TTL_MS);
    if (cached) return cached;

    const response = await fetch(`${BASE_URL}/leaderboard/rks/by-rank${query}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(extractProblemMessage(payload, '按排名区间查询失败'));
    }

    const data = (await response.json()) as LeaderboardTopResponse;
    writeCache(cacheKey, data);
    return data;
  }

  static async getMyRanking(): Promise<LeaderboardMeResponse> {
    const response = await fetch(`${BASE_URL}/leaderboard/rks/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(extractProblemMessage(payload, '获取我的排名失败'));
    }

    return response.json() as Promise<LeaderboardMeResponse>;
  }

  static async updateAlias(payload: AliasUpdatePayload): Promise<void> {
    const alias = payload.alias?.trim();
    if (!alias) {
      throw new Error('别名不能为空');
    }

    const response = await fetch(`${BASE_URL}/leaderboard/alias`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias }),
    });

    if (response.status === 409) {
      const payload = await response.json().catch(() => null);
      throw new Error(extractProblemMessage(payload, '别名已被占用，请尝试其他名称'));
    }

    if (response.status === 422) {
      const payload = await response.json().catch(() => null);
      throw new Error(extractProblemMessage(payload, '别名格式不符合要求'));
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(extractProblemMessage(payload, '更新别名失败'));
    }

    clearCache();
  }

  static async updateProfileSettings(
    options: UpdateProfileOptions,
  ): Promise<void> {
    const response = await fetch(`${BASE_URL}/leaderboard/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(extractProblemMessage(payload, '更新公开设置失败'));
    }

    clearCache();
  }

  static async getPublicProfile(alias: string): Promise<PublicProfileResponse> {
    const safeAlias = alias.trim();
    if (!safeAlias) {
      throw new Error('请输入要查询的别名');
    }

    const cacheKey = `leaderboard:public-profile:${safeAlias.toLowerCase()}`;
    const cached = readCache<PublicProfileResponse>(cacheKey, PUBLIC_PROFILE_CACHE_TTL_MS);
    if (cached) return cached;

    const response = await fetch(`${BASE_URL}/public/profile/${encodeURIComponent(safeAlias)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.status === 404) {
      const payload = await response.json().catch(() => null);
      throw new Error(extractProblemMessage(payload, '未找到对应的公开档案'));
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(extractProblemMessage(payload, '获取公开档案失败'));
    }

    const data = (await response.json()) as PublicProfileResponse;
    writeCache(cacheKey, data);
    return data;
  }
}
