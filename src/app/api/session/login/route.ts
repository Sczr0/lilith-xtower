import { NextRequest, NextResponse } from 'next/server'

import type { AuthCredential, TapTapVersion } from '@/app/lib/types/auth'
import { buildAuthRequestBody } from '@/app/lib/auth/authRequest'
import { toCredentialSummary } from '@/app/lib/auth/credentialSummary'
import { getAuthSession } from '@/app/lib/auth/session'
import { getSeekendApiBaseUrl } from '@/app/lib/auth/upstream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LoginRequestBody = {
  credential?: unknown
  taptapVersion?: unknown
}

function normalizeTapTapVersion(value: unknown): TapTapVersion {
  return value === 'global' ? 'global' : 'cn'
}

function parseCredential(value: unknown): AuthCredential | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const type = raw.type
  const timestamp = raw.timestamp
  if (typeof type !== 'string' || typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return null

  if (type === 'session') {
    const token = raw.token
    if (typeof token !== 'string' || !token.trim()) return null
    return { type: 'session', token, timestamp }
  }

  if (type === 'api') {
    const api_user_id = raw.api_user_id
    const api_token = raw.api_token
    if (typeof api_user_id !== 'string' || !api_user_id.trim()) return null
    if (api_token !== undefined && api_token !== null && typeof api_token !== 'string') return null
    return { type: 'api', api_user_id, api_token: api_token ?? undefined, timestamp }
  }

  if (type === 'platform') {
    const platform = raw.platform
    const platform_id = raw.platform_id
    if (typeof platform !== 'string' || !platform.trim()) return null
    if (typeof platform_id !== 'string' || !platform_id.trim()) return null
    return { type: 'platform', platform, platform_id, timestamp }
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as LoginRequestBody
    const credential = parseCredential(body.credential)
    if (!credential) {
      return NextResponse.json(
        { success: false, message: '无效的登录凭证' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const taptapVersion = normalizeTapTapVersion(body.taptapVersion)
    const authBody = buildAuthRequestBody(credential, taptapVersion)

    const upstream = `${getSeekendApiBaseUrl()}/save`
    const res = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(authBody),
      cache: 'no-store',
    })

    if (!res.ok) {
      // 4xx：凭证问题；5xx：上游问题
      const status = res.status
      const message = status >= 400 && status < 500 ? '登录凭证已过期或无效，请重新登录' : '服务器暂时无法访问，请稍后再试'
      return NextResponse.json(
        { success: false, message },
        { status: status >= 400 && status < 500 ? 401 : 502, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const session = await getAuthSession()
    session.credential = credential
    session.taptapVersion = taptapVersion
    session.createdAt = Date.now()
    await session.save()

    return NextResponse.json(
      { success: true, credential: toCredentialSummary(credential), taptapVersion },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Session login error:', error)
    return NextResponse.json(
      { success: false, message: `登录失败：${message}` },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}

