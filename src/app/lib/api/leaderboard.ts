import { AuthCredential } from '../types/auth';
import { buildAuthRequestBody } from './auth';
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
  /**
   * 获取排行榜 TOP 列表，支持 limit/offset。
   */
  static async getTop(params: LeaderboardQuery = {}): Promise<LeaderboardTopResponse> {
    const query = buildQueryString({
      limit: params.limit,
      offset: params.offset,
    });

    const response = await fetch(`${BASE_URL}/leaderboard/rks/top${query}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('获取排行榜数据失败');
    }

    return response.json() as Promise<LeaderboardTopResponse>;
  }

  /**
   * 按排名区间查询排行榜，支持 rank / start-end / start-count。
   */
  static async getByRank(params: RankQuery): Promise<LeaderboardTopResponse> {
    const query = buildQueryString({
      rank: params.rank,
      start: params.start,
      end: params.end,
      count: params.count,
    });

    const response = await fetch(`${BASE_URL}/leaderboard/rks/by-rank${query}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('按排名查询失败');
    }

    return response.json() as Promise<LeaderboardTopResponse>;
  }

  /**
   * 查询当前登录用户的榜单排名。
   */
  static async getMyRanking(credential: AuthCredential): Promise<LeaderboardMeResponse> {
    const body = buildAuthRequestBody(credential);
    const response = await fetch(`${BASE_URL}/leaderboard/rks/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error('获取我的排名失败');
    }

    return response.json() as Promise<LeaderboardMeResponse>;
  }

  /**
   * 绑定或更新排行榜别名。
   */
  static async updateAlias(credential: AuthCredential, payload: AliasUpdatePayload): Promise<void> {
    const alias = payload.alias?.trim();
    if (!alias) {
      throw new Error('别名不能为空');
    }

    const body = {
      alias,
      auth: buildAuthRequestBody(credential),
    };

    const response = await fetch(`${BASE_URL}/leaderboard/alias`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.status === 409) {
      throw new Error('别名已被占用，请尝试其他名称');
    }

    if (response.status === 422) {
      throw new Error('别名格式不符合要求');
    }

    if (!response.ok) {
      throw new Error('更新别名失败');
    }
  }

  /**
   * 更新排行榜档案的公开设置。
   */
  static async updateProfileSettings(
    credential: AuthCredential,
    options: UpdateProfileOptions,
  ): Promise<void> {
    const body = {
      auth: buildAuthRequestBody(credential),
      ...options,
    };

    const response = await fetch(`${BASE_URL}/leaderboard/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error('更新公开设置失败');
    }
  }

  /**
   * 获取公开档案信息。
   */
  static async getPublicProfile(alias: string): Promise<PublicProfileResponse> {
    const safeAlias = alias.trim();
    if (!safeAlias) {
      throw new Error('请输入要查询的别名');
    }

    const response = await fetch(`${BASE_URL}/public/profile/${encodeURIComponent(safeAlias)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.status === 404) {
      throw new Error('未找到对应的公开档案');
    }

    if (!response.ok) {
      throw new Error('获取公开档案失败');
    }

    return response.json() as Promise<PublicProfileResponse>;
  }
}
