import { AuthCredential } from '../types/auth';
import {
  RksResponse,
  RksHistoryResponse,
  ServiceStatsFeature,
  ServiceStatsResponse,
  StatsSummaryApiResponse,
} from '../types/score';
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
    const rawSave = data?.save;
    const rawGameRecord =
      rawSave && typeof rawSave === 'object' && rawSave !== null && 'game_record' in rawSave
        ? (rawSave as { game_record?: unknown }).game_record
        : undefined;
    const gameRecord =
      rawGameRecord && typeof rawGameRecord === 'object' && rawGameRecord !== null
        ? (rawGameRecord as Record<string, unknown>)
        : {};

    // 计算 RKS 的公式
    const calculateRks = (acc: number, constant: number): number => {
      if (constant <= 0) return 0;

      // acc 为百分数（如 96.00 表示 96%）
      // 准确率未达到 70% 时，RKS 记为 0
      if (acc < 70) return 0;

      // RKS 计算公式: rks = ((100 × Acc - 55) / 45)² × level
      // 其中 acc 需要先转为小数形式
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

      // songKey 格式为“歌曲名 - 艺术家”，直接视为歌曲名
      const songName = songKey;

      for (const record of songRecords) {
        if (!record || typeof record !== 'object') continue;

        const entry = record as Record<string, unknown>;
        const difficulty = entry['difficulty'];

        if (difficulty !== 'EZ' && difficulty !== 'HD' && difficulty !== 'IN' && difficulty !== 'AT') {
          continue;
        }

        const accuracySource = entry['accuracy'] ?? entry['acc'];
        const accuracy = typeof accuracySource === 'number' ? accuracySource : 0;
        const scoreValue = entry['score'];
        const score = typeof scoreValue === 'number' ? scoreValue : 0;
        const constantValue = entry['chart_constant'];
        const chartConstant = typeof constantValue === 'number' ? constantValue : 0;

        records.push({
          song_name: songName,
          difficulty,
          difficulty_value: chartConstant,
          acc: accuracy,
          score,
          rks: calculateRks(accuracy, chartConstant),
        });
      }
    }

    const result: RksResponse = {
      code: 200,
      data: { records },
    };
    return result;
  }

  /**
   * 获取用户 RKS 历史变化记录
   */
  static async getRksHistory(
    credential: AuthCredential,
    options?: { limit?: number; offset?: number }
  ): Promise<RksHistoryResponse> {
    const requestBody = {
      auth: buildAuthRequestBody(credential),
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    };

    const response = await fetch(`${BASE_URL}/rks/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let message = '获取 RKS 历史记录失败';
      try {
        const data = await response.json();
        if (data?.message) message = data.message;
      } catch (error) {
        console.error('解析 RKS 历史记录错误信息失败:', error);
      }
      throw new Error(message);
    }

    const data = await response.json();
    return {
      items: data.items || [],
      total: data.total || 0,
      current_rks: data.current_rks || 0,
      peak_rks: data.peak_rks || 0,
    };
  }

  static async getServiceStats(): Promise<ServiceStatsResponse> {
    const response = await fetch(`${BASE_URL}/stats/summary`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      let message = '获取服务统计失败';
      try {
        const payload = await response.json();
        if (payload?.message) message = payload.message;
      } catch {
        // 忽略解析错误，沿用默认文案
      }
      throw new Error(message);
    }

    let raw: StatsSummaryApiResponse;
    try {
      raw = await response.json();
    } catch {
      throw new Error('解析服务统计响应失败');
    }

    const normalizeCount = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    };

    const normalizeDate = (value: unknown): string | null => {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
      return null;
    };

    const rawFeatures = Array.isArray(raw.features)
      ? raw.features
          .map((item, index) => {
            if (!item || typeof item !== 'object') return null;
            const key =
              typeof item.feature === 'string' && item.feature.trim().length > 0
                ? item.feature
                : `unknown_${index}`;
            return {
              key,
              count: normalizeCount(item.count),
              lastUpdated: normalizeDate(item.last_at),
            };
          })
          .filter((entry): entry is ServiceStatsFeature => entry !== null)
      : [];

    const mergedFeatures = new Map<string, ServiceStatsFeature>();
    const toTimestamp = (value: string | null): number => {
      if (!value) return 0;
      const ts = Date.parse(value);
      return Number.isNaN(ts) ? 0 : ts;
    };

    for (const feature of rawFeatures) {
      const existing = mergedFeatures.get(feature.key);
      if (!existing) {
        mergedFeatures.set(feature.key, { ...feature });
        continue;
      }
      existing.count += feature.count;
      if (toTimestamp(feature.lastUpdated) > toTimestamp(existing.lastUpdated)) {
        existing.lastUpdated = feature.lastUpdated;
      }
    }

    const features = Array.from(mergedFeatures.values()).sort((a, b) => b.count - a.count);

    const uniqueUsersRaw = raw.unique_users ?? {};
    const total = normalizeCount(uniqueUsersRaw.total);
    const byKind: [string, number][] = Array.isArray(uniqueUsersRaw.by_kind)
      ? uniqueUsersRaw.by_kind
          .filter((entry): entry is [unknown, unknown] => Array.isArray(entry) && entry.length >= 2)
          .map(([kind, count]) => {
            const name = String(kind ?? 'unknown');
            return [name, normalizeCount(count)];
          })
      : [];

    return {
      timezone: typeof raw.timezone === 'string' && raw.timezone ? raw.timezone : 'UTC',
      configStartAt:
        typeof raw.config_start_at === 'string' || raw.config_start_at === null ? raw.config_start_at : null,
      firstEventAt:
        typeof raw.first_event_at === 'string' || raw.first_event_at === null ? raw.first_event_at : null,
      lastEventAt:
        typeof raw.last_event_at === 'string' || raw.last_event_at === null ? raw.last_event_at : null,
      features,
      uniqueUsers: {
        total,
        byKind,
      },
    };
  }
}
