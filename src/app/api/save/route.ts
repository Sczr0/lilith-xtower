import { NextRequest, NextResponse } from 'next/server'

import { getSessionAuthContext } from '@/app/lib/auth/sessionAuthContext'
import { getSeekendApiBaseUrl } from '@/app/lib/auth/upstream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 30_000

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

/**
 * /api/save（需要鉴权）
 * - 说明：客户端不再提交 token；由服务端从 session 注入 authBody 并直连上游。
 */
export async function POST(request: NextRequest) {
  const ctx = await getSessionAuthContext()
  if (!ctx) return jsonError('未登录', 401)

  const upstream = `${getSeekendApiBaseUrl()}/save${request.nextUrl.search}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(ctx.authBody),
      cache: 'no-store',
      signal: controller.signal,
    })

    const raw = await res.text()
    const headers = new Headers()
    headers.set('Cache-Control', 'no-store')
    headers.set('Content-Type', res.headers.get('content-type') ?? 'application/json; charset=utf-8')

    return new NextResponse(raw, { status: res.status, headers })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = /aborted|abort/i.test(message)
    return jsonError(isTimeout ? '请求超时，请稍后重试' : '请求失败，请稍后重试', isTimeout ? 504 : 502)
  } finally {
    clearTimeout(timeout)
  }
}

