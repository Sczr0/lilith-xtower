import { NextResponse } from 'next/server'

import { withAuth } from '@/app/lib/api/withAuth'
import { getSeekendApiBaseUrl } from '@/app/lib/auth/upstream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 15_000

/**
 * /api/auth/user-id（需要鉴权）
 * - 说明：用于在"联合 API 仪表板"中获取本站 userId（站内ID），避免客户端拼接 token。
 */
export const POST = withAuth(async (_req, ctx) => {
  const upstream = `${getSeekendApiBaseUrl()}/auth/user-id`
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
    return NextResponse.json(
      { message: isTimeout ? '请求超时，请稍后重试' : '请求失败，请稍后重试' },
      { status: isTimeout ? 504 : 502, headers: { 'Cache-Control': 'no-store' } },
    )
  } finally {
    clearTimeout(timeout)
  }
})
