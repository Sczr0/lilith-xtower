export type DifficultyCode = 'EZ' | 'HD' | 'IN' | 'AT';

export interface ChartTextItem {
  song: string;
  difficulty: DifficultyCode;
  acc: number;
  rks: number;
}

export interface RksCompositionText {
  best27Sum: number;
  apTop3Sum: number;
}

export interface LeaderboardTopItem {
  rank: number;
  user: string;
  score: number;
  updatedAt: string;
  alias?: string | null;
  apTop3?: ChartTextItem[] | null;
  bestTop3?: ChartTextItem[] | null;
}

export interface LeaderboardTopResponse {
  items: LeaderboardTopItem[];
  total: number;
  nextAfterScore?: number | null;
  nextAfterUser?: string | null;
  nextAfterUpdated?: string | null;
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
  updatedAt: string;
  apTop3?: ChartTextItem[] | null;
  bestTop3?: ChartTextItem[] | null;
  rksComposition?: RksCompositionText | null;
}

export interface UpdateProfileOptions {
  isPublic?: boolean | null;
  showApTop3?: boolean | null;
  showBestTop3?: boolean | null;
  showRksComposition?: boolean | null;
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

