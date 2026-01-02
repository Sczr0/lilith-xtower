import { AuthCredential } from '../types/auth';
import {
  RksResponse,
  RksHistoryResponse,
  ServiceStatsFeature,
  ServiceStatsResponse,
  StatsSummaryApiResponse,
} from '../types/score';
import { buildAuthRequestBody } from './auth';
import { extractProblemMessage } from './problem';

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
      const payload = await response.json().catch(() => null);
      throw new Error(extractProblemMessage(payload, '获取 RKS 列表失败'));
    }

    const data = (await response.json()) as unknown;
    const rawSave =
      data && typeof data === 'object'
        ? 'save' in data
          ? (data as { save?: unknown }).save
          : 'data' in data
            ? (data as { data?: unknown }).data
            : data
        : null;

    const rawGameRecord =
      rawSave && typeof rawSave === 'object' && rawSave !== null
        ? 'gameRecord' in rawSave
          ? (rawSave as { gameRecord?: unknown }).gameRecord
          : 'game_record' in rawSave
            ? (rawSave as { game_record?: unknown }).game_record
            : undefined
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

    const normalizeNumber = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const isDifficultyCode = (value: unknown): value is 'EZ' | 'HD' | 'IN' | 'AT' =>
      value === 'EZ' || value === 'HD' || value === 'IN' || value === 'AT';

    const toRecordList = (value: unknown): unknown[] => {
      if (Array.isArray(value)) return value;
      if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>);
      return [];
    };

    for (const [songKey, songRecords] of Object.entries(gameRecord)) {
      const songName = songKey;
      for (const record of toRecordList(songRecords)) {
        if (!record || typeof record !== 'object') continue;

        const entry = record as Record<string, unknown>;
        const difficulty = entry['difficulty'];
        if (!isDifficultyCode(difficulty)) continue;

        const accuracy = normalizeNumber(entry['accuracy'] ?? entry['acc']);
        const score = normalizeNumber(entry['score']);
        const chartConstant = normalizeNumber(
          entry['chartConstant'] ?? entry['chart_constant'] ?? entry['difficulty_value'] ?? entry['constant'],
        );

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
      const payload = await response.json().catch(() => null);
      throw new Error(extractProblemMessage(payload, '获取 RKS 历史记录失败'));
    }

    const data = (await response.json()) as Partial<RksHistoryResponse>;
    return {
      items: Array.isArray(data.items) ? data.items : [],
      total: typeof data.total === 'number' ? data.total : 0,
      currentRks: typeof data.currentRks === 'number' ? data.currentRks : 0,
      peakRks: typeof data.peakRks === 'number' ? data.peakRks : 0,
    };
  }

  static async getServiceStats(): Promise<ServiceStatsResponse> {
    const response = await fetch(`${BASE_URL}/stats/summary`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(extractProblemMessage(payload, '获取服务统计失败'));
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
              lastUpdated: normalizeDate(item.lastAt),
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

    const uniqueUsersRaw = raw.uniqueUsers ?? {};
    const total = normalizeCount(uniqueUsersRaw.total);
    const byKind: [string, number][] = Array.isArray(uniqueUsersRaw.byKind)
      ? uniqueUsersRaw.byKind
          .filter((entry): entry is [unknown, unknown] => Array.isArray(entry) && entry.length >= 2)
          .map(([kind, count]) => {
            const name = String(kind ?? 'unknown');
            return [name, normalizeCount(count)];
          })
      : [];

    return {
      timezone: typeof raw.timezone === 'string' && raw.timezone ? raw.timezone : 'UTC',
      configStartAt:
        typeof raw.configStartAt === 'string' || raw.configStartAt === null ? raw.configStartAt : null,
      firstEventAt:
        typeof raw.firstEventAt === 'string' || raw.firstEventAt === null ? raw.firstEventAt : null,
      lastEventAt:
        typeof raw.lastEventAt === 'string' || raw.lastEventAt === null ? raw.lastEventAt : null,
      features,
      uniqueUsers: {
        total,
        byKind,
      },
    };
  }
}
