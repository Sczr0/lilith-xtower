// 联合API（第三方）相关类型定义

export type UnifiedApiPlatformName = string;

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
