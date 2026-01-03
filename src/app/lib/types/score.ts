export interface RksRecord {
  song_name: string;
  difficulty: 'EZ' | 'HD' | 'IN' | 'AT';
  difficulty_value: number;
  acc: number;
  score: number;
  rks: number;
}

export interface RksResponse {
  code: number;
  data: {
    records: RksRecord[];
  };
}

/**
 * Stats summary 的原始返回结构（对齐新版 OpenAPI：camelCase）。
 * - 上游：GET /stats/summary
 */
export interface StatsSummaryApiFeature {
  feature?: string;
  count?: number;
  lastAt?: string | null;
}

export interface StatsSummaryApiUniqueUsers {
  total?: number;
  byKind?: Array<[unknown, unknown]>;
}

export interface StatsSummaryApiResponse {
  timezone?: string;
  configStartAt?: string | null;
  firstEventAt?: string | null;
  lastEventAt?: string | null;
  features?: StatsSummaryApiFeature[];
  uniqueUsers?: StatsSummaryApiUniqueUsers;
}

export interface ServiceStatsFeature {
  key: string;
  count: number;
  lastUpdated: string | null;
}

export interface ServiceStatsResponse {
  timezone: string;
  configStartAt: string | null;
  firstEventAt: string | null;
  lastEventAt: string | null;
  features: ServiceStatsFeature[];
  uniqueUsers: {
    total: number;
    byKind: [string, number][];
  };
}

/**
 * 按日聚合统计（来自 /stats/daily/*）
 * - 注意：后端使用 YYYY-MM-DD 日期字符串，并可通过 timezone 参数改变日期解释与输出口径。
 */
export interface DailyDauRow {
  date: string; // YYYY-MM-DD
  activeUsers: number;
  activeIps: number;
}

export interface DailyDauResponse {
  timezone: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  rows: DailyDauRow[];
}

export interface DailyFeatureUsageRow {
  date: string; // YYYY-MM-DD
  feature: string;
  count: number;
  uniqueUsers: number;
}

export interface DailyFeaturesResponse {
  timezone: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  featureFilter: string | null;
  rows: DailyFeatureUsageRow[];
}

export interface DailyHttpTotalRow {
  date: string; // YYYY-MM-DD
  total: number;
  errors: number;
  errorRate: number;
  clientErrors: number;
  serverErrors: number;
  clientErrorRate: number;
  serverErrorRate: number;
}

export interface DailyHttpRouteRow extends DailyHttpTotalRow {
  route: string;
  method: string;
}

export interface DailyHttpResponse {
  timezone: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  routeFilter: string | null;
  methodFilter: string | null;
  totals: DailyHttpTotalRow[];
  routes: DailyHttpRouteRow[];
}

// RKS 历史记录相关类型（对齐新版 OpenAPI：camelCase）
export interface RksHistoryItem {
  rks: number; // 当时的 RKS 值
  rksJump: number; // RKS 变化量
  createdAt: string; // ISO 8601 时间戳（UTC RFC3339）
}

export interface RksHistoryResponse {
  items: RksHistoryItem[]; // 历史记录列表（按时间倒序）
  total: number; // 总记录数
  currentRks: number; // 当前 RKS
  peakRks: number; // 历史最高 RKS
}
