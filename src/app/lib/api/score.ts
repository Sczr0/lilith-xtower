import { AuthCredential } from '../types/auth';
import { RksResponse, ServiceStatsResponse } from '../types/score';
import { buildAuthRequestBody } from './auth';

const BASE_URL = '/api';

export class ScoreAPI {
  static async getRksList(credential: AuthCredential): Promise<RksResponse> {
    const requestBody = buildAuthRequestBody(credential);

    const response = await fetch(`${BASE_URL}/save?calculate_rks=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let message = '获取 RKS 列表失败';
      try {
        const data = await response.json();
        if (data?.message) message = data.message;
      } catch (error) {
        console.error('解析 RKS 列表错误信息失败:', error);
      }
      throw new Error(message);
    }

    const data = await response.json();
    const charts: Array<{ song_id: string; difficulty: 'EZ' | 'HD' | 'IN' | 'AT'; rks: number }>
      = data?.rks?.b30_charts || [];
    const save: any = data?.save ?? {};
    const gameRecord = save?.game_record ?? {};

    const fetchSongInfo = async (songId: string) => {
      try {
        const params = new URLSearchParams({ q: songId, unique: 'true' });
        const res = await fetch(`${BASE_URL}/songs/search?${params.toString()}`);
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    };

    const records = await Promise.all(
      charts.map(async (c) => {
        const info = await fetchSongInfo(c.song_id);
        const name: string = info?.name ?? c.song_id;
        const constants = info?.chart_constants ?? {};
        const diffKey = c.difficulty.toLowerCase();
        const difficulty_value: number = typeof constants?.[diffKey] === 'number' ? constants[diffKey] : 0;

        // 尝试从 save.game_record 中提取 ACC（字段名未知，尽力匹配）
        let acc = 0;
        try {
          const record = gameRecord?.[c.song_id];
          if (record) {
            const d = record[c.difficulty] || record[diffKey] || record[c.difficulty.toLowerCase()];
            const maybeAcc = d?.acc ?? d?.accuracy ?? d?.ACC ?? d?.Accuracy;
            if (typeof maybeAcc === 'number') acc = maybeAcc;
          }
        } catch {}

        return {
          song_name: name,
          difficulty: c.difficulty,
          difficulty_value,
          acc,
          rks: c.rks,
        };
      })
    );

    const result: RksResponse = {
      code: 200,
      data: { records },
    };
    return result;
  }

  static async getServiceStats(): Promise<ServiceStatsResponse> {
    const response = await fetch(`${BASE_URL}/stats/summary`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('获取服务统计失败');
    }

    const data = await response.json();
    const features: Array<{ feature: string; count: number; last_at: string | null }> = data?.features || [];

    const find = (name: string) => features.find((f) => f.feature === name);
    const bestn = find('bestn') || { count: 0, last_at: null } as any;
    const single = find('single_query') || find('song') || { count: 0, last_at: null } as any;

    const fallbackDate = new Date(0).toISOString();
    const mapped: ServiceStatsResponse = {
      bn: {
        count: bestn.count || 0,
        last_updated: bestn.last_at || fallbackDate,
      },
      leaderboard: {
        count: 0,
        last_updated: fallbackDate,
      },
      song: {
        count: single.count || 0,
        last_updated: single.last_at || fallbackDate,
      },
    };
    return mapped;
  }
}
