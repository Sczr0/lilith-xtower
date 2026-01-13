import { NextResponse } from 'next/server'

import { getAuthSession } from '@/app/lib/auth/session'
import { toCredentialSummary, type SessionStatusResponse } from '@/app/lib/auth/credentialSummary'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getAuthSession()
    const credential = session.credential

    const payload: SessionStatusResponse = {
      isAuthenticated: !!credential,
      credential: credential ? toCredentialSummary(credential) : null,
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

