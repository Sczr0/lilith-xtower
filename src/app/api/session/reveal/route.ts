import { NextResponse } from 'next/server'

import type { AuthCredential, TapTapVersion } from '@/app/lib/types/auth'
import { guardBackendSession } from '@/app/lib/auth/backendSessionGuard'
import { ensureAuthSessionKey, getAuthSession } from '@/app/lib/auth/session'
import { slidingWindowAllow } from '@/app/lib/api/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RevealCredentialResponse =
  | {
      success: true
      credential: AuthCredential
      taptapVersion: TapTapVersion | null
      createdAt: number | null
    }
  | { success: false; error: string }

const REVEAL_RATE_WINDOW_MS = 10 * 60 * 1000
const REVEAL_RATE_MAX = 5

function allowReveal(sessionKey: string): boolean {
  return slidingWindowAllow(`reveal:${sessionKey}`, REVEAL_RATE_MAX, REVEAL_RATE_WINDOW_MS)
}

/**
 * 显式回传完整凭证（高风险能力）。
 * - 默认不调用；仅在用户在 /auth 页手动点击后触发。
 * - 每会话 10 分钟内最多 reveal 5 次，超出返回 429。
 * - 响应强制 no-store，避免任何缓存层持久化敏感信息。
 */
export async function POST() {
  try {
    const session = await getAuthSession()
    const guard = await guardBackendSession(session)

    if (guard.status === 'upstream_error') {
      const payload: RevealCredentialResponse = { success: false, error: '会话校验失败，请稍后重试' }
      return NextResponse.json(payload, { status: 502, headers: { 'Cache-Control': 'no-store' } })
    }

    if (guard.status !== 'valid') {
      const payload: RevealCredentialResponse = { success: false, error: '未登录' }
      return NextResponse.json(payload, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }

    const credential = session.credential

    if (!credential) {
      const payload: RevealCredentialResponse = { success: false, error: '未登录' }
      return NextResponse.json(payload, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }

    const sessionKey = ensureAuthSessionKey(session)
    if (!allowReveal(sessionKey)) {
      return NextResponse.json(
        { success: false, error: '请求过于频繁，请稍后重试' },
        { status: 429, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const payload: RevealCredentialResponse = {
      success: true,
      credential,
      taptapVersion: session.taptapVersion ?? null,
      createdAt: session.createdAt ?? null,
    }

    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    // 安全：不要输出完整 credential
    console.error('Session reveal error:', error)
    return NextResponse.json(
      { success: false, error: `获取完整凭证失败：${message}` },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
