import { NextResponse } from 'next/server'

import { getConsentStatus } from '@/app/lib/auth/consent'
import { getAuthSession } from '@/app/lib/auth/session'
import { guardBackendSession } from '@/app/lib/auth/backendSessionGuard'
import { toCredentialSummary, type SessionStatusResponse } from '@/app/lib/auth/credentialSummary'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 未认证场景下下发的协议版本基线（accepted 均为 null，consentRequired 为 false）。 */
function buildUnsignedConsentPayload(extra?: Record<string, unknown>) {
  const baseline = getConsentStatus({})
  return {
    isAuthenticated: false,
    credential: null,
    taptapVersion: null,
    requiredAgreementVersion: baseline.requiredAgreementVersion,
    requiredPrivacyVersion: baseline.requiredPrivacyVersion,
    acceptedAgreementVersion: null,
    acceptedPrivacyVersion: null,
    consentRequired: false,
    ...extra,
  }
}

export async function GET() {
  try {
    const session = await getAuthSession()
    const guard = await guardBackendSession(session, { mode: 'lazy' })

    if (guard.status === 'upstream_error') {
      return NextResponse.json(
        buildUnsignedConsentPayload({ error: '会话校验失败，请稍后重试' }),
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    if (guard.status !== 'valid') {
      return NextResponse.json(buildUnsignedConsentPayload(), {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const credential = session.credential
    if (!credential) {
      return NextResponse.json(buildUnsignedConsentPayload(), {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const consent = getConsentStatus(session)
    const payload: SessionStatusResponse = {
      isAuthenticated: true,
      credential: toCredentialSummary(credential),
      taptapVersion: session.taptapVersion ?? null,
      requiredAgreementVersion: consent.requiredAgreementVersion,
      requiredPrivacyVersion: consent.requiredPrivacyVersion,
      acceptedAgreementVersion: consent.acceptedAgreementVersion,
      acceptedPrivacyVersion: consent.acceptedPrivacyVersion,
      consentRequired: consent.consentRequired,
    }

    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Session status error:', error)
    return NextResponse.json(
      buildUnsignedConsentPayload({ error: message }),
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
