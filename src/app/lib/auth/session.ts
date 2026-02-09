import { cookies } from 'next/headers'
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session'

import type { AuthCredential, TapTapVersion } from '../types/auth'
import { AUTH_SESSION_COOKIE_NAME } from '../constants/cookies'
import { isAuthSessionRevoked } from './sessionRevocation'

export type AuthSessionData = {
  credential?: AuthCredential
  taptapVersion?: TapTapVersion
  createdAt?: number
  backendAccessToken?: string
  backendExpAt?: number
  sessionKey?: string
}

/**
 * 说明：将 iron-session 的数据字段声明为全局可见，便于在不同模块复用。
 */
declare module 'iron-session' {
  interface IronSessionData {
    credential?: AuthCredential
    taptapVersion?: TapTapVersion
    createdAt?: number
    backendAccessToken?: string
    backendExpAt?: number
    sessionKey?: string
  }
}

// 说明：iron-session 要求 password 至少 32 字符；这里提供开发兜底，生产必须配置环境变量。
const DEV_FALLBACK_PASSWORD = 'dev_only_password_change_me_32_chars!'
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7

function hashText(value: string): string {
  let hashA = 0x811c9dc5
  let hashB = 0x01000193

  for (let index = 0; index < value.length; index += 1) {
    const charCode = value.charCodeAt(index)
    hashA ^= charCode
    hashA = Math.imul(hashA, 0x01000193)

    hashB ^= charCode
    hashB = Math.imul(hashB, 0x85ebca6b)
  }

  const partA = (hashA >>> 0).toString(16).padStart(8, '0')
  const partB = (hashB >>> 0).toString(16).padStart(8, '0')
  return `${partA}${partB}`
}

function generateSessionKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function buildCredentialFingerprint(credential: AuthCredential): string {
  if (credential.type === 'session') {
    return `session:${hashText(credential.token)}`
  }

  if (credential.type === 'api') {
    return `api:${credential.api_user_id}`
  }

  return `platform:${credential.platform}:${credential.platform_id}`
}

function buildLegacySessionKey(data: Pick<AuthSessionData, 'credential' | 'createdAt' | 'taptapVersion'>): string | null {
  if (!data.credential || typeof data.createdAt !== 'number') {
    return null
  }

  const source = JSON.stringify({
    createdAt: data.createdAt,
    taptapVersion: data.taptapVersion ?? null,
    credentialType: data.credential.type,
    credentialTimestamp: data.credential.timestamp,
    credentialFingerprint: buildCredentialFingerprint(data.credential),
  })

  return `legacy:${hashText(source)}`
}

function clearAuthSessionData(session: IronSession<AuthSessionData>): void {
  delete session.credential
  delete session.taptapVersion
  delete session.createdAt
  delete session.backendAccessToken
  delete session.backendExpAt
  delete session.sessionKey
}

export function getSessionRevocationKey(data: Pick<AuthSessionData, 'sessionKey' | 'credential' | 'createdAt' | 'taptapVersion'>): string | null {
  const normalizedSessionKey = data.sessionKey?.trim()
  if (normalizedSessionKey) {
    return `sid:${normalizedSessionKey}`
  }

  return buildLegacySessionKey(data)
}

export function ensureAuthSessionKey(session: IronSession<AuthSessionData>): string {
  if (!session.sessionKey) {
    session.sessionKey = generateSessionKey()
  }
  return session.sessionKey
}

export function getAuthSessionTtlMs(): number {
  return DEFAULT_TTL_SECONDS * 1000
}

function getSessionOptions(): SessionOptions {
  const raw = (process.env.AUTH_SESSION_PASSWORD || '').trim()
  
  // 尝试解析 JSON 以支持多密钥（Key Rotation）
  // 格式：'{"2": "new_pass", "1": "old_pass"}'
  let password: string | Record<string, string> = raw
  try {
    if (raw.startsWith('{')) {
      password = JSON.parse(raw)
    }
  } catch {
    // 解析失败则视为普通字符串密钥
  }

  // 开发环境兜底
  if (!password && process.env.NODE_ENV !== 'production') {
    password = DEV_FALLBACK_PASSWORD
  }

  if (!password || (typeof password === 'string' && !password) || (typeof password === 'object' && Object.keys(password).length === 0)) {
    // 生产环境缺少密钥时给出明确错误（运行时）
    throw new Error('AUTH_SESSION_PASSWORD 未设置：生产环境必须配置用于加密会话 Cookie 的密钥')
  }

  return {
    password,
    cookieName: AUTH_SESSION_COOKIE_NAME,
    ttl: DEFAULT_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    },
  }
}

export async function getAuthSession(): Promise<IronSession<AuthSessionData>> {
  const options = getSessionOptions()
  const cookieStore = await cookies()
  const session = await getIronSession<AuthSessionData>(cookieStore, options)

  const revocationKey = getSessionRevocationKey(session)
  if (revocationKey && isAuthSessionRevoked(revocationKey)) {
    session.destroy()
    clearAuthSessionData(session)
  }

  return session
}
