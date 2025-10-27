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
