import 'server-only'
import { getSeekendApiBaseUrl } from './upstream'

const BASE_URL = getSeekendApiBaseUrl()
const EXCHANGE_SECRET = process.env.PHI_EXCHANGE_SECRET!

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

  const res = await fetch(`${BASE_URL}/auth/session/exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Exchange-Secret': EXCHANGE_SECRET,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`exchange failed: ${res.status} ${text}`)
  }

  return res.json() as Promise<{
    accessToken: string
    expiresIn: number
    tokenType: 'Bearer'
  }>
}

export async function logoutBackendToken(accessToken: string, scope: 'current' | 'all') {
  const res = await fetch(`${BASE_URL}/auth/session/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ scope }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`logout failed: ${res.status} ${text}`)
  }

  return res.json() as Promise<{
    scope: 'current' | 'all'
    revokedJti: string
    logoutBefore?: string
  }>
}
