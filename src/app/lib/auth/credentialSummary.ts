import type { AuthCredential, TapTapVersion } from '../types/auth'
import { maskSecret } from '@/app/utils/maskSecret'

/**
 * 前端可安全展示的认证信息摘要（不包含完整 token）。
 */
export type AuthCredentialSummary =
  | { type: 'session'; timestamp: number; tokenMasked: string }
  | { type: 'api'; timestamp: number; api_user_id: string; api_token_masked?: string }
  | { type: 'platform'; timestamp: number; platform: string; platform_id: string }

export type SessionStatusResponse = {
  isAuthenticated: boolean
  credential: AuthCredentialSummary | null
  taptapVersion: TapTapVersion | null
}

export function toCredentialSummary(credential: AuthCredential): AuthCredentialSummary {
  switch (credential.type) {
    case 'session':
      return {
        type: 'session',
        timestamp: credential.timestamp,
        tokenMasked: maskSecret(credential.token),
      }
    case 'api':
      return {
        type: 'api',
        timestamp: credential.timestamp,
        api_user_id: credential.api_user_id,
        api_token_masked: credential.api_token ? maskSecret(credential.api_token) : undefined,
      }
    case 'platform':
      return {
        type: 'platform',
        timestamp: credential.timestamp,
        platform: credential.platform,
        platform_id: credential.platform_id,
      }
    default:
      throw new Error('不支持的凭证类型')
  }
}

