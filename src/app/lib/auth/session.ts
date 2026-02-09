import { cookies } from 'next/headers'
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session'

import type { AuthCredential, TapTapVersion } from '../types/auth'
import { AUTH_SESSION_COOKIE_NAME } from '../constants/cookies'

export type AuthSessionData = {
  credential?: AuthCredential
  taptapVersion?: TapTapVersion
  createdAt?: number
  backendAccessToken?: string
  backendExpAt?: number
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
  }
}

// 说明：iron-session 要求 password 至少 32 字符；这里提供开发兜底，生产必须配置环境变量。
const DEV_FALLBACK_PASSWORD = 'dev_only_password_change_me_32_chars!'
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7

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
  return getIronSession<AuthSessionData>(cookieStore, options)
}
