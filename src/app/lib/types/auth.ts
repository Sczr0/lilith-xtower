// 认证方式枚举
export type AuthMethod = 'qrcode' | 'manual' | 'api' | 'platform';

// 二维码登录相关类型
export interface QRCodeResponse {
  qrCodeImage: string;
  qrId: string;
}

export interface QRCodeStatusResponse {
  status: 'scanning' | 'success' | 'expired';
  sessionToken?: string;
}

// 登录凭证类型
export interface SessionCredential {
  type: 'session';
  token: string;
  timestamp: number;
}

export interface APICredential {
  type: 'api';
  api_user_id: string;
  api_token?: string;
  timestamp: number;
}

export interface PlatformCredential {
  type: 'platform';
  platform: string;
  platform_id: string;
  timestamp: number;
}

export type AuthCredential = SessionCredential | APICredential | PlatformCredential;

// 认证状态类型
export interface AuthState {
  isAuthenticated: boolean;
  credential: AuthCredential | null;
  isLoading: boolean;
  error: string | null;
}

// API请求体类型
export interface SessionTokenRequest {
  token: string;
}

export interface APIRequest {
  data_source: 'external';
  api_user_id: string;
  api_token?: string;
}

export interface PlatformRequest {
  data_source: 'external';
  platform: string;
  platform_id: string;
}

export type AuthRequest = SessionTokenRequest | APIRequest | PlatformRequest;

// 登录表单数据类型
export interface ManualLoginForm {
  token: string;
}

export interface APILoginForm {
  api_user_id: string;
  api_token?: string;
}

export interface PlatformLoginForm {
  platform: string;
  platform_id: string;
}