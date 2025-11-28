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

export interface StatsSummaryApiFeature {
  feature?: string;
  count?: number;
  last_at?: string | null;
}

export interface StatsSummaryApiUniqueUsers {
  total?: number;
  by_kind?: Array<[unknown, unknown]>;
}

export interface StatsSummaryApiResponse {
  timezone?: string;
  config_start_at?: string | null;
  first_event_at?: string | null;
  last_event_at?: string | null;
  features?: StatsSummaryApiFeature[];
  unique_users?: StatsSummaryApiUniqueUsers;
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

// RKS 历史记录相关类型
export interface RksHistoryItem {
  rks: number;           // 当时的 RKS 值
  rks_jump: number;      // RKS 变化量
  created_at: string;    // ISO 8601 时间戳
}

export interface RksHistoryResponse {
  items: RksHistoryItem[];  // 历史记录列表（按时间倒序）
  total: number;            // 总记录数
  current_rks: number;      // 当前 RKS
  peak_rks: number;         // 历史最高 RKS
}
