import {
  RksResponse,
  RksHistoryResponse,
  DailyDauResponse,
  DailyFeaturesResponse,
  DailyHttpResponse,
  ServiceStatsFeature,
  ServiceStatsResponse,
  StatsSummaryApiResponse,
} from '../types/score';
import { extractProblemMessage } from './problem';

const BASE_URL = '/api';

export class ScoreAPI {
  static async getRksList(): Promise<RksResponse> {
    const response = await fetch(`${BASE_URL}/save?calculate_rks=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
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
      push_acc?: number | null;
      unreachable?: boolean;
      phi_only?: boolean;
      already_phi?: boolean;
    }> = [];

    const normalizeNumber = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const normalizeOptionalNumber = (value: unknown): number | null | undefined => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value === 'number') return Number.isFinite(value) ? value : null;
      if (typeof value === 'string') {
        const raw = value.trim();
        if (!raw) return null;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
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

        const rawPushAcc = entry['push_acc'] !== undefined ? entry['push_acc'] : entry['pushAcc'];
        const rawHint = entry['push_acc_hint'] ?? entry['pushAccHint'] ?? entry['push_end'] ?? entry['pushEnd'];
        const hint = rawHint && typeof rawHint === 'object' ? (rawHint as Record<string, unknown>) : null;
        const hintType = hint && typeof hint.type === 'string' ? hint.type : null;
        const hintAcc = hint ? normalizeOptionalNumber(hint.acc) : undefined;

        const unreachable = entry['unreachable'] === true || hintType === 'unreachable';
        const phi_only = entry['phi_only'] === true || hintType === 'phi_only';
        const already_phi = entry['already_phi'] === true || hintType === 'already_phi';

        const parsedPushAcc = normalizeOptionalNumber(rawPushAcc);
        const push_acc = parsedPushAcc === undefined ? hintAcc : parsedPushAcc;

        records.push({
          song_name: songName,
          difficulty,
          difficulty_value: chartConstant,
          acc: accuracy,
          score,
          rks: calculateRks(accuracy, chartConstant),
          ...(push_acc === undefined ? {} : { push_acc }),
          unreachable,
          phi_only,
          already_phi,
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
    options?: { limit?: number; offset?: number }
  ): Promise<RksHistoryResponse> {
    const requestBody = {
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

  /**
   * 获取按日聚合的 DAU（活跃用户/活跃 IP）
   * - 上游：GET /stats/daily/dau
   */
  static async getDailyDau(params: { start: string; end: string; timezone?: string }): Promise<DailyDauResponse> {
    const search = new URLSearchParams({
      start: params.start,
      end: params.end,
    });
    if (params.timezone) search.set('timezone', params.timezone);

    const response = await fetch(`${BASE_URL}/stats/daily/dau?${search.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(extractProblemMessage(payload, '获取每日活跃数据失败'));
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new Error('解析每日活跃数据响应失败');
    }
    if (!raw || typeof raw !== 'object') {
      return { timezone: params.timezone ?? 'UTC', start: params.start, end: params.end, rows: [] };
    }

    const normalizeCount = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    };

    const obj = raw as Record<string, unknown>;
    const rows = Array.isArray(obj.rows)
      ? obj.rows
          .map((row) => {
            if (!row || typeof row !== 'object') return null;
            const entry = row as Record<string, unknown>;
            const date = typeof entry.date === 'string' ? entry.date : null;
            if (!date) return null;
            return {
              date,
              activeUsers: normalizeCount(entry.activeUsers),
              activeIps: normalizeCount(entry.activeIps),
            };
          })
          .filter((row): row is DailyDauResponse['rows'][number] => row !== null)
      : [];

    return {
      timezone: typeof obj.timezone === 'string' && obj.timezone ? obj.timezone : params.timezone ?? 'UTC',
      start: typeof obj.start === 'string' && obj.start ? obj.start : params.start,
      end: typeof obj.end === 'string' && obj.end ? obj.end : params.end,
      rows,
    };
  }

  /**
   * 获取按日聚合的 HTTP 统计（总量/错误率 + top 路由）
   * - 上游：GET /stats/daily/http
   */
  static async getDailyHttp(params: {
    start: string;
    end: string;
    timezone?: string;
    route?: string;
    method?: string;
    top?: number;
  }): Promise<DailyHttpResponse> {
    const search = new URLSearchParams({
      start: params.start,
      end: params.end,
    });
    if (params.timezone) search.set('timezone', params.timezone);
    if (params.route) search.set('route', params.route);
    if (params.method) search.set('method', params.method);
    if (typeof params.top === 'number' && Number.isFinite(params.top)) search.set('top', String(params.top));

    const response = await fetch(`${BASE_URL}/stats/daily/http?${search.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(extractProblemMessage(payload, '获取每日 HTTP 统计失败'));
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new Error('解析每日 HTTP 统计响应失败');
    }
    if (!raw || typeof raw !== 'object') {
      return {
        timezone: params.timezone ?? 'UTC',
        start: params.start,
        end: params.end,
        routeFilter: params.route ?? null,
        methodFilter: params.method ?? null,
        totals: [],
        routes: [],
      };
    }

    const normalizeCount = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    };

    const normalizeRate = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    };

    const normalizeTotalRow = (value: unknown) => {
      if (!value || typeof value !== 'object') return null;
      const entry = value as Record<string, unknown>;
      const date = typeof entry.date === 'string' ? entry.date : null;
      if (!date) return null;
      return {
        date,
        total: normalizeCount(entry.total),
        errors: normalizeCount(entry.errors),
        errorRate: normalizeRate(entry.errorRate),
        clientErrors: normalizeCount(entry.clientErrors),
        serverErrors: normalizeCount(entry.serverErrors),
        clientErrorRate: normalizeRate(entry.clientErrorRate),
        serverErrorRate: normalizeRate(entry.serverErrorRate),
      };
    };

    const obj = raw as Record<string, unknown>;
    const totals = Array.isArray(obj.totals)
      ? obj.totals.map(normalizeTotalRow).filter((row): row is DailyHttpResponse['totals'][number] => row !== null)
      : [];

    const routes = Array.isArray(obj.routes)
      ? obj.routes
          .map((value) => {
            if (!value || typeof value !== 'object') return null;
            const entry = value as Record<string, unknown>;
            const route = typeof entry.route === 'string' ? entry.route : null;
            const method = typeof entry.method === 'string' ? entry.method : null;
            const base = normalizeTotalRow(entry);
            if (!route || !method || !base) return null;
            return { ...base, route, method };
          })
          .filter((row): row is DailyHttpResponse['routes'][number] => row !== null)
      : [];

    const routeFilter = typeof obj.routeFilter === 'string' ? obj.routeFilter : obj.routeFilter === null ? null : params.route ?? null;
    const methodFilter = typeof obj.methodFilter === 'string' ? obj.methodFilter : obj.methodFilter === null ? null : params.method ?? null;

    return {
      timezone: typeof obj.timezone === 'string' && obj.timezone ? obj.timezone : params.timezone ?? 'UTC',
      start: typeof obj.start === 'string' && obj.start ? obj.start : params.start,
      end: typeof obj.end === 'string' && obj.end ? obj.end : params.end,
      routeFilter,
      methodFilter,
      totals,
      routes,
    };
  }

  /**
   * 获取按日聚合的功能使用统计
   * - 上游：GET /stats/daily/features
   */
  static async getDailyFeatures(params: {
    start: string;
    end: string;
    timezone?: string;
    feature?: string;
  }): Promise<DailyFeaturesResponse> {
    const search = new URLSearchParams({
      start: params.start,
      end: params.end,
    });
    if (params.timezone) search.set('timezone', params.timezone);
    if (params.feature) search.set('feature', params.feature);

    const response = await fetch(`${BASE_URL}/stats/daily/features?${search.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(extractProblemMessage(payload, '获取每日功能使用统计失败'));
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new Error('解析每日功能使用统计响应失败');
    }
    if (!raw || typeof raw !== 'object') {
      return {
        timezone: params.timezone ?? 'UTC',
        start: params.start,
        end: params.end,
        featureFilter: params.feature ?? null,
        rows: [],
      };
    }

    const normalizeCount = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    };

    const obj = raw as Record<string, unknown>;
    const rows = Array.isArray(obj.rows)
      ? obj.rows
          .map((row) => {
            if (!row || typeof row !== 'object') return null;
            const entry = row as Record<string, unknown>;
            const date = typeof entry.date === 'string' ? entry.date : null;
            const feature = typeof entry.feature === 'string' ? entry.feature : null;
            if (!date || !feature) return null;
            return {
              date,
              feature,
              count: normalizeCount(entry.count),
              uniqueUsers: normalizeCount(entry.uniqueUsers),
            };
          })
          .filter((row): row is DailyFeaturesResponse['rows'][number] => row !== null)
      : [];

    const featureFilter =
      typeof obj.featureFilter === 'string'
        ? obj.featureFilter
        : obj.featureFilter === null
          ? null
          : params.feature ?? null;

    return {
      timezone: typeof obj.timezone === 'string' && obj.timezone ? obj.timezone : params.timezone ?? 'UTC',
      start: typeof obj.start === 'string' && obj.start ? obj.start : params.start,
      end: typeof obj.end === 'string' && obj.end ? obj.end : params.end,
      featureFilter,
      rows,
    };
  }
}
