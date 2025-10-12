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

export interface ServiceStat {
  count: number;
  last_updated: string;
}

export interface ServiceStatsResponse {
  bn: ServiceStat;
  leaderboard: ServiceStat;
  song: ServiceStat;
  // 可选扩展功能
  save?: ServiceStat;
  bestn_user?: ServiceStat;
  song_search?: ServiceStat;
  single_query?: ServiceStat;
  // 时间与用户分布
  time?: {
    timezone: string;
    config_start_at: string | null;
    first_event_at: string | null;
    last_event_at: string | null;
  };
  users?: {
    total: number;
    by_kind: [string, number][];
  };
}
