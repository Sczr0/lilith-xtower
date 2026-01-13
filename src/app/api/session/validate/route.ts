import { NextResponse } from 'next/server'

import { buildAuthRequestBody } from '@/app/lib/auth/authRequest'
import { getAuthSession } from '@/app/lib/auth/session'
import { getSeekendApiBaseUrl } from '@/app/lib/auth/upstream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ValidateResponse = {
  isValid: boolean
  shouldLogout: boolean
  error?: string
}

export async function POST() {
  try {
    const session = await getAuthSession()
    const credential = session.credential
    const taptapVersion = session.taptapVersion ?? 'cn'

    if (!credential) {
      const payload: ValidateResponse = { isValid: false, shouldLogout: true, error: '未登录' }
      return NextResponse.json(payload, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }

    const authBody = buildAuthRequestBody(credential, taptapVersion)
    const upstream = `${getSeekendApiBaseUrl()}/save`
    const res = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(authBody),
      cache: 'no-store',
    })

    if (res.ok) {
      const payload: ValidateResponse = { isValid: true, shouldLogout: false }
      return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (res.status >= 400 && res.status < 500) {
      // 凭证无效：清理 session
      session.destroy()
      const payload: ValidateResponse = {
        isValid: false,
        shouldLogout: true,
        error: '登录凭证已过期或无效，请重新登录',
      }
      return NextResponse.json(payload, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }

    const payload: ValidateResponse = {
      isValid: false,
      shouldLogout: false,
      error: '服务器暂时无法访问，请稍后再试',
    }
    return NextResponse.json(payload, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Session validate error:', error)
    return NextResponse.json(
      { isValid: false, shouldLogout: false, error: `验证失败：${message}` },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}

