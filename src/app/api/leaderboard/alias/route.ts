import { NextResponse } from 'next/server'

import { withAuth } from '@/app/lib/api/withAuth'
import { getSeekendApiBaseUrl } from '@/app/lib/auth/upstream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 30_000

/**
 * /api/leaderboard/alias（需要鉴权）
 * - body: { alias }
 */
export const PUT = withAuth(async (req, ctx) => {
  const rawBody = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const alias = typeof rawBody.alias === 'string' ? rawBody.alias.trim() : ''
  if (!alias) {
    return NextResponse.json({ message: '别名不能为空' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const upstream = `${getSeekendApiBaseUrl()}/leaderboard/alias`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(upstream, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ alias, auth: ctx.authBody }),
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
