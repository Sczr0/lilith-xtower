import type { AuthRequest, TapTapVersion } from '../types/auth'
import { buildAuthRequestBody } from './authRequest'
import { getAuthSession } from './session'

export type SessionAuthContext = {
  authBody: AuthRequest
  taptapVersion: TapTapVersion
}

/**
 * 从服务端 HttpOnly 会话中提取鉴权信息，并构造上游请求所需的 authBody。
 *
 * 重要说明（P0-1）：
 * - 客户端不再持有/拼接原始 token；
 * - 需要鉴权的请求统一在服务端完成 auth 注入。
 */
export async function getSessionAuthContext(): Promise<SessionAuthContext | null> {
  const session = await getAuthSession()
  const credential = session.credential
  if (!credential) return null

  const taptapVersion = session.taptapVersion ?? 'cn'
  const authBody = buildAuthRequestBody(credential, taptapVersion)

  return { authBody, taptapVersion }
}

