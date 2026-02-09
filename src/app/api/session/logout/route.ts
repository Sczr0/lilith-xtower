import { NextRequest, NextResponse } from 'next/server'

import { getAuthSession, getAuthSessionTtlMs, getSessionRevocationKey } from '@/app/lib/auth/session'
import { logoutBackendToken } from '@/app/lib/auth/phi-session'
import { revokeAuthSession } from '@/app/lib/auth/sessionRevocation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LogoutBody = {
  scope?: 'current' | 'all'
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as LogoutBody
    const scope = body.scope === 'all' ? 'all' : 'current'

    const session = await getAuthSession()

    if (session.backendAccessToken) {
      try {
        await logoutBackendToken(session.backendAccessToken, scope)
      } catch (e) {
        console.warn('Backend logout failed:', e)
      }
    }

    const revocationKey = getSessionRevocationKey(session)
    if (revocationKey) {
      revokeAuthSession(revocationKey, getAuthSessionTtlMs())
    }

    session.destroy()
    return NextResponse.json({ success: true, scope }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Session logout error:', error)
    return NextResponse.json(
      { success: false, message: `退出登录失败：${message}` },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
