import { NextResponse } from 'next/server'

import { withAuth } from '@/app/lib/api/withAuth'
import { getSeekendApiBaseUrl } from '@/app/lib/auth/upstream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 30_000

/**
 * /api/leaderboard/profile（需要鉴权）
 * - body: UpdateProfileOptions（不含 auth）
 */
export const PUT = withAuth(async (req, ctx) => {
  const rawBody = (await req.json().catch(() => ({}))) as Record<string, unknown>
  // 客户端不允许提交 auth 字段（由服务端注入）
  const options: Record<string, unknown> = { ...rawBody }
  delete options.auth

  const upstream = `${getSeekendApiBaseUrl()}/leaderboard/profile`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(upstream, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ auth: ctx.authBody, ...options }),
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
