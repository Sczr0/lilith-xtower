import 'server-only'
import { getSeekendApiBaseUrl } from './upstream'

const BASE_URL = getSeekendApiBaseUrl()
const EXCHANGE_SECRET = process.env.PHI_EXCHANGE_SECRET!

/** 上游会话接口超时（毫秒）：把「上游抽风」变成有界失败，避免请求无限挂起。 */
const DEFAULT_UPSTREAM_TIMEOUT_MS = 5_000

function resolveTimeoutMs(): number {
  const raw = Number.parseInt((process.env.PHI_SESSION_TIMEOUT_MS || '').trim(), 10)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_UPSTREAM_TIMEOUT_MS
}

type BackendTokenResponse = {
  accessToken: string
  expiresIn: number
  tokenType: 'Bearer'
}

export class BackendSessionError extends Error {
  operation: 'exchange' | 'refresh' | 'logout'
  status: number
  responseText: string

  constructor(operation: 'exchange' | 'refresh' | 'logout', status: number, responseText: string) {
    super(`${operation} failed: ${status} ${responseText}`)
    this.name = 'BackendSessionError'
    this.operation = operation
    this.status = status
    this.responseText = responseText
  }
}

export function isBackendSessionError(value: unknown): value is BackendSessionError {
  return value instanceof BackendSessionError
}

/** 上游请求统一入口：强制超时，超时以 BackendSessionError(504) 形式抛出（非 401，不会被误判为登出）。 */
async function fetchUpstream(
  operation: 'exchange' | 'refresh' | 'logout',
  input: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, { ...init, signal: AbortSignal.timeout(resolveTimeoutMs()) })
  } catch (error) {
    const isAbort = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    if (isAbort) {
      throw new BackendSessionError(operation, 504, `上游 ${operation} 超时`)
    }
    throw error
  }
}

function ensureExchangeSecret(operation: 'refresh'): string {
  if (EXCHANGE_SECRET) return EXCHANGE_SECRET
  throw new BackendSessionError(operation, 500, 'PHI_EXCHANGE_SECRET 未配置，无法校验后端会话')
}

async function parseBackendResponse<T>(
  operation: 'exchange' | 'refresh' | 'logout',
  response: Response,
): Promise<T> {
  if (!response.ok) {
    const text = await response.text()
    throw new BackendSessionError(operation, response.status, text)
  }

  return response.json() as Promise<T>
}

type ExchangeBody = {
  sessionToken?: string
  externalCredentials?: {
    platform?: string
    platformId?: string
    sessiontoken?: string
    apiUserId?: string
    apiToken?: string
  }
}

export async function exchangeBackendToken(body: ExchangeBody) {
  // 容错：如果没有配置交换密钥，说明还没准备好对接，暂不报错但无法获取 token
  if (!EXCHANGE_SECRET) {
    console.warn('PHI_EXCHANGE_SECRET not set, skipping token exchange')
    return null
  }

  const res = await fetchUpstream('exchange', `${BASE_URL}/auth/session/exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Exchange-Secret': EXCHANGE_SECRET,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  return parseBackendResponse<BackendTokenResponse>('exchange', res)
}

export async function refreshBackendToken(oldAccessToken: string) {
  const sharedSecret = ensureExchangeSecret('refresh')

  const res = await fetchUpstream('refresh', `${BASE_URL}/auth/session/refresh`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${oldAccessToken}`,
      'X-Exchange-Secret': sharedSecret,
    },
    cache: 'no-store',
  })

  return parseBackendResponse<BackendTokenResponse>('refresh', res)
}

export async function logoutBackendToken(accessToken: string, scope: 'current' | 'all') {
  const res = await fetchUpstream('logout', `${BASE_URL}/auth/session/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ scope }),
    cache: 'no-store',
  })

  return parseBackendResponse<{
    scope: 'current' | 'all'
    revokedJti: string
    logoutBefore?: string
  }>('logout', res)
}
