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
      if (constant <= 0) return 0;
      
      // acc 是百分数形式（如 96.00 表示 96%）
      // 准确率未达到70%时，RKS为0
      if (acc < 70) return 0;
      
      // RKS计算公式: rks = ((100 × Acc - 55) / 45)² × level（谱面定数）
      // 其中 Acc 是小数形式（0.96），但传入的 acc 是百分数（96），所以需要先除以100
      const accDecimal = acc / 100;
      const factor = Math.pow((100 * accDecimal - 55) / 45, 2);
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
    const save = find('save') || { count: 0, last_at: null } as any;
    const bestnUser = find('bestn_user') || { count: 0, last_at: null } as any;
    const songSearch = find('song_search') || { count: 0, last_at: null } as any;

    const fallbackDate = new Date(0).toISOString();

    const statOf = (entry: any) => ({
      count: entry?.count || 0,
      last_updated: entry?.last_at || fallbackDate,
    });

    const mapped: ServiceStatsResponse = {
      bn: statOf(bestn),
      // 仍保留 leaderboard 字段，按需展示（当前无数据时 count=0）
      leaderboard: { count: 0, last_updated: fallbackDate },
      // 兼容旧字段：song 代表单曲查询
      song: statOf(single),
      // 新增扩展字段
      single_query: statOf(single),
      save: statOf(save),
      bestn_user: statOf(bestnUser),
      song_search: statOf(songSearch),
      // 附带时间与用户分布信息
      time: {
        timezone: data?.timezone ?? 'UTC',
        config_start_at: data?.config_start_at ?? null,
        first_event_at: data?.first_event_at ?? null,
        last_event_at: data?.last_event_at ?? null,
      },
      users: {
        total: data?.unique_users?.total ?? 0,
        by_kind: Array.isArray(data?.unique_users?.by_kind) ? data.unique_users.by_kind : [],
      },
    };
    return mapped;
  }
}
