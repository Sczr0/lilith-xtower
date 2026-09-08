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

/**
 * 同一会话的 refresh 去重（进程内）。
 *
 * 背景：多标签页/并发请求可能在同一时刻都判定「token 临近过期」，
 * 从而对上游发起重复 refresh（上游往往一次性失效旧 token，重复请求只会互相踩）。
 * 这里以 sessionKey 为键复用进行中的 Promise：等待者只共享结果，不各自打上游。
 * 单实例部署（PM2 instances: 1）下语义完整；多实例时退化为「每实例去重」。
 */
const inFlightRefreshes = new Map<string, Promise<RefreshResult>>()

type RefreshResult = { accessToken: string; expiresIn: number }

function refreshOnce(sessionKey: string | undefined, backendAccessToken: string): Promise<RefreshResult> {
  const key = sessionKey?.trim()
  if (!key) {
    return refreshBackendToken(backendAccessToken)
  }

  const existing = inFlightRefreshes.get(key)
  if (existing) return existing

  const task = (async () => {
    try {
      return await refreshBackendToken(backendAccessToken)
    } finally {
      inFlightRefreshes.delete(key)
    }
  })()

  inFlightRefreshes.set(key, task)
  return task
}

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
 * - 其他错误（含上游超时 504）：视为上游不可用，不清理会话，交给路由返回 5xx。
 *
 * 注意：不要把它挂到「会话状态查询」这类高频只读接口上——上游抖动会直接变成
 * 接口变慢/报错，客户端会把「查不到」误判为「未登录」。上游校验应放在
 * 真正需要后端 token 的接口（如 /api/session/reveal）。
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
    const refreshed = await refreshOnce(session.sessionKey, backendAccessToken)
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
