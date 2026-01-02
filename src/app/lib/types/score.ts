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

