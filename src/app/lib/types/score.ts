export interface RksRecord {
  song_name: string;
  difficulty: 'EZ' | 'HD' | 'IN' | 'AT';
  difficulty_value: number;
  acc: number;
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
}
