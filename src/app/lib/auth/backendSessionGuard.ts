import type { IronSession } from 'iron-session'

import type { AuthSessionData } from './session'
import { isBackendSessionError, refreshBackendToken } from './phi-session'

export type BackendSessionGuardMode = 'strict' | 'lazy'

export type BackendSessionGuardOptions = {
  mode?: BackendSessionGuardMode
  refreshWindowMs?: number
}

export type BackendSessionGuardResult =
  | { status: 'valid' }
  | { status: 'invalid'; reason: 'missing_token' | 'token_rejected' }
  | { status: 'upstream_error'; message: string }

const DEFAULT_REFRESH_WINDOW_MS = 2 * 60 * 1000

function clearBackendToken(session: IronSession<AuthSessionData>): void {
  delete session.backendAccessToken
  delete session.backendExpAt
}

function shouldRefreshToken(
  session: IronSession<AuthSessionData>,
  mode: BackendSessionGuardMode,
  refreshWindowMs: number,
): boolean {
  if (mode === 'strict') {
    return true
  }

  const backendExpAt = session.backendExpAt
  if (typeof backendExpAt !== 'number') {
    return true
  }

  return backendExpAt - Date.now() <= refreshWindowMs
}

/**
 * 说明：以后端 refresh 接口作为 token 真值校验。
 * - strict：每次都 refresh，安全优先。
 * - lazy：仅在 token 临近过期时 refresh，性能优先。
 * - 校验成功：更新 token 与过期时间并持久化（lazy 且未到窗口时直接判定 valid）。
 * - 401：判定未登录，销毁本地会话。
 * - 其他错误：视为上游不可用，不清理会话，交给路由返回 5xx。
 */
export async function guardBackendSession(
  session: IronSession<AuthSessionData>,
  options: BackendSessionGuardOptions = {},
): Promise<BackendSessionGuardResult> {
  const backendAccessToken = session.backendAccessToken?.trim()
  if (!backendAccessToken) {
    return { status: 'invalid', reason: 'missing_token' }
  }

  const mode = options.mode ?? 'strict'
  const refreshWindowMs = options.refreshWindowMs ?? DEFAULT_REFRESH_WINDOW_MS

  if (!shouldRefreshToken(session, mode, refreshWindowMs)) {
    return { status: 'valid' }
  }

  try {
    const refreshed = await refreshBackendToken(backendAccessToken)
    session.backendAccessToken = refreshed.accessToken
    session.backendExpAt = Date.now() + refreshed.expiresIn * 1000
    await session.save()
    return { status: 'valid' }
  } catch (error) {
    if (isBackendSessionError(error) && error.status === 401) {
      clearBackendToken(session)
      session.destroy()
      return { status: 'invalid', reason: 'token_rejected' }
    }

    const message = error instanceof Error ? error.message : '未知错误'
    return { status: 'upstream_error', message }
  }
}
