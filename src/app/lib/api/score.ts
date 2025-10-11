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
    const save: any = data?.save ?? {};
    const gameRecord = save?.game_record ?? {};

    // 计算 RKS 的公式
    const calculateRks = (acc: number, constant: number): number => {
      if (acc < 70) return 0;
      if (constant <= 0) return 0;
      
      // 新的RKS计算公式: rks = ((100 × Acc - 55) / 45)² × level
      const factor = Math.pow((100 * acc - 55) / 45, 2);
      return constant * factor;
    };

    // 从 game_record 中提取所有歌曲的成绩
    const records: Array<{
      song_name: string;
      difficulty: 'EZ' | 'HD' | 'IN' | 'AT';
      difficulty_value: number;
      acc: number;
      score: number;
      rks: number;
    }> = [];

    for (const [songKey, songRecords] of Object.entries(gameRecord)) {
      if (!Array.isArray(songRecords)) continue;
      
      // songKey 格式为 "歌曲名.艺术家"，直接使用作为歌曲名
      const songName = songKey;
      
      for (const record of songRecords as any[]) {
        if (!record || typeof record !== 'object') continue;
        
        const difficulty = record.difficulty as 'EZ' | 'HD' | 'IN' | 'AT';
        const accuracy = record.accuracy ?? record.acc ?? 0;
        const score = record.score ?? 0;
        const chart_constant = record.chart_constant ?? 0;
        
        if (difficulty && ['EZ', 'HD', 'IN', 'AT'].includes(difficulty)) {
          records.push({
            song_name: songName,
            difficulty,
            difficulty_value: chart_constant,
            acc: accuracy,
            score,
            rks: calculateRks(accuracy, chart_constant),
          });
        }
      }
    }

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
