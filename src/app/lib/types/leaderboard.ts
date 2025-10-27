export type DifficultyCode = 'EZ' | 'HD' | 'IN' | 'AT';

export interface ChartTextItem {
  song: string;
  difficulty: DifficultyCode;
  acc: number;
  rks: number;
}

export interface RksCompositionText {
  best27_sum: number;
  ap_top3_sum: number;
}

export interface LeaderboardTopItem {
  rank: number;
  user: string;
  score: number;
  updated_at: string;
  alias?: string | null;
  ap_top3?: ChartTextItem[] | null;
  best_top3?: ChartTextItem[] | null;
}

export interface LeaderboardTopResponse {
  items: LeaderboardTopItem[];
  total: number;
  next_after_score?: number | null;
  next_after_user?: string | null;
  next_after_updated?: string | null;
}

export interface LeaderboardMeResponse {
  rank: number;
  score: number;
  total: number;
  percentile: number;
}

export interface PublicProfileResponse {
  alias: string;
  score: number;
  updated_at: string;
  ap_top3?: ChartTextItem[] | null;
  best_top3?: ChartTextItem[] | null;
  rks_composition?: RksCompositionText | null;
}

export interface UpdateProfileOptions {
  is_public?: boolean | null;
  show_ap_top3?: boolean | null;
  show_best_top3?: boolean | null;
  show_rks_composition?: boolean | null;
}

export interface RankQuery {
  rank?: number;
  start?: number;
  end?: number;
  count?: number;
}

export interface LeaderboardQuery {
  limit?: number;
  offset?: number;
}

export interface AliasUpdatePayload {
  alias: string;
}
