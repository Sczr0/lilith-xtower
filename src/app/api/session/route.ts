import { NextResponse } from 'next/server'

import { getConsentStatus } from '@/app/lib/auth/consent'
import { getAuthSession } from '@/app/lib/auth/session'
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

/**
 * 会话状态查询（前端初始化鉴权状态的唯一权威来源）。
 *
 * 设计约束（P0-2）：
 * - 只做本地判定：读取 iron-session Cookie + 撤销表，**不发起任何上游请求**。
 * - 上游 token 的真值校验属于「用到它」的接口（如 /api/session/reveal 为 strict 模式），
 *   不放在状态接口上：否则上游一次抖动就会让本接口变慢/报 5xx，客户端据此误判「未登录」，
 *   触发 /dashboard ↔ /login 来回跳转（守卫把「查不到」当成「没登录」）。
 * - 因此本接口的响应时间与上游无关；isAuthenticated 仅表示「本地会话存在且未被撤销」。
 */
export async function GET() {
  try {
    const session = await getAuthSession()
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
