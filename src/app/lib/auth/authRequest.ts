import type { AuthCredential, AuthRequest, TapTapVersion } from '../types/auth'

/**
 * 构造上游（seekend）认证请求体。
 * 说明：
 * - 这是纯函数，避免依赖 localStorage（P0-1：不允许在 JS 可读存储中持久化凭证）。
 * - taptapVersion 由登录时确定并写入服务端 session。
 */
export function buildAuthRequestBody(credential: AuthCredential, taptapVersion: TapTapVersion): AuthRequest {
  switch (credential.type) {
    case 'session':
      return {
        sessionToken: credential.token,
        taptapVersion,
      }
    case 'api':
      return {
        externalCredentials: {
          apiUserId: credential.api_user_id,
          apiToken: credential.api_token ?? null,
        },
        taptapVersion,
      }
    case 'platform':
      return {
        externalCredentials: {
          platform: credential.platform,
          platformId: credential.platform_id,
        },
        taptapVersion,
      }
    default:
      // TypeScript 严格模式下不可达，但保留兜底便于未来扩展
      throw new Error('不支持的凭证类型')
  }
}

