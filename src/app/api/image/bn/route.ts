import { NextResponse } from 'next/server'

import { withAuth } from '@/app/lib/api/withAuth'
import { createSemaphore } from '@/app/lib/api/upstreamSemaphore'
import { getSeekendApiBaseUrl } from '@/app/lib/auth/upstream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 30_000

/** 上游渲染并发上限：避免突发请求同时打满上游（超出的排队等待）。 */
const upstreamGate = createSemaphore(4)

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * /api/image/bn（需要鉴权）
 * - body: { n, theme }
 * - query: format=png|svg
 */
export const POST = withAuth(async (req, ctx) => {
  const rawBody = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const n = toNumber(rawBody.n)
  const theme = typeof rawBody.theme === 'string' ? rawBody.theme : 'black'

  if (!n || !Number.isInteger(n) || n <= 0) {
    return NextResponse.json({ message: 'N 值必须为正整数' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const upstream = `${getSeekendApiBaseUrl()}/image/bn${req.nextUrl.search}`

  try {
    // 过并发闸；超时用 AbortSignal.timeout，从真正发起上游请求时才开始计时（排队时间不计入）
    const res = await upstreamGate.run(() =>
      fetch(upstream, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: '*/*' },
        body: JSON.stringify({ ...rawBody, ...ctx.authBody, n, theme }),
        cache: 'no-store',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
    )

    if (!res.ok) {
      const raw = await res.text()
      const headers = new Headers()
      headers.set('Cache-Control', 'no-store')
      headers.set('Content-Type', res.headers.get('content-type') ?? 'application/json; charset=utf-8')
      return new NextResponse(raw, { status: res.status, headers })
    }

    const headers = new Headers()
    headers.set('Cache-Control', 'no-store')
    const contentType = res.headers.get('content-type')
    if (contentType) headers.set('Content-Type', contentType)
    headers.set('X-Content-Type-Options', 'nosniff')

    return new NextResponse(res.body, { status: 200, headers })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = /aborted|abort/i.test(message)
    return NextResponse.json(
      { message: isTimeout ? '请求超时，请稍后重试' : '请求失败，请稍后重试' },
      { status: isTimeout ? 504 : 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
})
