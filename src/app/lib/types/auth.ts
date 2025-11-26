// 认证方式枚举
export type AuthMethod = 'qrcode' | 'manual' | 'api' | 'platform';

// TapTap版本类型
export type TapTapVersion = 'cn' | 'global';

// 二维码登录相关类型
export interface QRCodeResponse {
  qrCodeImage: string;
  qrId: string;
  /**
   * 新增字段：TapTap 登录链接，形如：https://accounts.taptap.cn/device?qrcode=1&user_code=xxxxx
   * 用于在移动端通过深链拉起 TapTap 直接确认登录
   */
  qrcodeUrl?: string;
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

// 统一请求体（适配新后端）
export interface ExternalApiCredentials {
  platform?: string | null;
  platformId?: string | null;
  apiUserId?: string | null;
  apiToken?: string | null;
  sessiontoken?: string | null;
}

// 统一请求体（适配新后端）
export interface UnifiedSaveRequestBody {
  sessionToken?: string | null;
  taptapVersion?: TapTapVersion;
  externalCredentials?: ExternalApiCredentials | null;
}

export type AuthRequest = UnifiedSaveRequestBody;

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