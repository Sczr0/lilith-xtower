import { NextResponse } from 'next/server'

import { getAuthSession } from '@/app/lib/auth/session'
import { guardBackendSession } from '@/app/lib/auth/backendSessionGuard'
import { toCredentialSummary, type SessionStatusResponse } from '@/app/lib/auth/credentialSummary'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getAuthSession()
    const guard = await guardBackendSession(session, { mode: 'lazy' })

    if (guard.status === 'upstream_error') {
      return NextResponse.json(
        { isAuthenticated: false, credential: null, taptapVersion: null, error: '会话校验失败，请稍后重试' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    if (guard.status !== 'valid') {
      return NextResponse.json(
        { isAuthenticated: false, credential: null, taptapVersion: null },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const credential = session.credential
    if (!credential) {
      return NextResponse.json(
        { isAuthenticated: false, credential: null, taptapVersion: null },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const payload: SessionStatusResponse = {
      isAuthenticated: true,
      credential: toCredentialSummary(credential),
      taptapVersion: session.taptapVersion ?? null,
    }

    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Session status error:', error)
    return NextResponse.json(
      { isAuthenticated: false, credential: null, taptapVersion: null, error: message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
