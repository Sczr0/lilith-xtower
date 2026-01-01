// 联合API（第三方）相关类型定义

export type UnifiedApiPlatformName = string;

/**
 * 联合API难度枚举（与上游文档一致）
 */
export type UnifiedApiLevelKind = 'EZ' | 'HD' | 'IN' | 'AT';

/**
 * 单曲成绩排名排序字段（与上游文档一致）
 */
export type UnifiedApiScoreListOrderBy = 'acc' | 'score' | 'fc' | 'updated_at';

export interface UnifiedApiBaseAuth {
  platform: UnifiedApiPlatformName;
  platform_id: string;
  token: string; // PhigrosToken（联合API文档字段名为 token）
  api_user_id?: string;
  api_token?: string;
  isGlobal?: boolean;
}

export interface UnifiedApiAdvancedAuth {
  token: string;
  api_user_id: string;
  api_token: string;
  platform?: UnifiedApiPlatformName;
  platform_id?: string;
}

export type UnifiedApiBindRequest = UnifiedApiBaseAuth;

export type UnifiedApiHaveApiToken = 0 | 1 | 2;

export interface UnifiedApiBindResponse {
  message: string;
  data: {
    internal_id: string;
    haveApiToken: UnifiedApiHaveApiToken;
  };
}

export interface UnifiedApiSetApiTokenRequest extends UnifiedApiAdvancedAuth {
  token_new: string;
}

export interface UnifiedApiSetApiTokenResponse {
  message: string;
}

export type UnifiedApiTokenListRequest = UnifiedApiAdvancedAuth;

export interface UnifiedApiTokenListResponse {
  data: {
    platform_data: Array<{
      platform_name: string;
      platform_id: string;
      create_at: string;
      update_at: string;
      authentication: number;
    }>;
  };
}

export interface UnifiedApiUnbindRequest {
  platform: UnifiedApiPlatformName;
  platform_id: string;
}

export interface UnifiedApiUnbindResponse {
  message: string;
}

export interface UnifiedApiCloudSongRequest extends UnifiedApiBaseAuth {
  song_id: string;
  difficulty?: string | number;
}

/**
 * 检索用户名（PlayerId）
 * POST /get/playerIdList
 */
export interface UnifiedApiPlayerIdListRequest {
  playerId: string;
  maxLength?: number;
}

export interface UnifiedApiPlayerIdListResponse {
  data: Array<{
    apiId: string;
    playerId: string;
  }>;
}

/**
 * 根据名次获取排行榜相关信息
 * POST /get/ranklist/rank
 */
export interface UnifiedApiRanklistRankRequest {
  request_rank: number;
}

export interface UnifiedApiRanklistSummary {
  rankingScore: number;
  challengeModeRank: number;
  updatedAt?: string;
  avatar?: string;
}

export interface UnifiedApiRanklistSaveInfo {
  summary: UnifiedApiRanklistSummary;
  modifiedAt: { iso: string };
  PlayerId: string;
}

export interface UnifiedApiRanklistUserEntry {
  gameuser: { background: string };
  saveInfo: UnifiedApiRanklistSaveInfo;
  index: number;
}

export interface UnifiedApiRanklistData {
  totDataNum: number;
  users: UnifiedApiRanklistUserEntry[];
  me?: unknown;
}

export interface UnifiedApiRanklistResponse {
  data: UnifiedApiRanklistData;
}

/**
 * 根据用户获取排行榜相关信息
 * POST /get/ranklist/user
 */
export type UnifiedApiRanklistUserRequest = UnifiedApiAdvancedAuth;

/**
 * 获取用户的单曲成绩排名
 * POST /get/scoreList/user
 */
export interface UnifiedApiScoreListUserRequest extends UnifiedApiAdvancedAuth {
  songId: string;
  rank: UnifiedApiLevelKind;
  orderBy?: UnifiedApiScoreListOrderBy;
}

export interface UnifiedApiScoreListUserRecord {
  score: number;
  acc: number;
  fc: number;
  updated_at: number;
}

export interface UnifiedApiScoreListUserGameUser {
  background: string;
  rankingScore: number;
  challengeModeRank: number;
  avatar: string;
  modifiedAt: string;
  PlayerId: string;
}

export interface UnifiedApiScoreListUserEntry {
  gameuser: UnifiedApiScoreListUserGameUser;
  record: UnifiedApiScoreListUserRecord;
  index: number;
}

export interface UnifiedApiScoreListUserResponse {
  data: {
    totDataNum: number;
    userRank: number;
    users: UnifiedApiScoreListUserEntry[];
  };
}
