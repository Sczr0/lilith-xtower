import { NextResponse } from 'next/server'

import { withAuth } from '@/app/lib/api/withAuth'
import { createSemaphore } from '@/app/lib/api/upstreamSemaphore'
import { getSeekendApiBaseUrl } from '@/app/lib/auth/upstream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 30_000

/** 上游渲染并发上限：避免突发请求同时打满上游（超出的排队等待）。 */
const upstreamGate = createSemaphore(4)

/**
 * /api/image/song（需要鉴权）
 * - body: { song }
 */
export const POST = withAuth(async (req, ctx) => {
  const rawBody = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const song = typeof rawBody.song === 'string' ? rawBody.song.trim() : ''
  if (!song) {
    return NextResponse.json({ message: '歌曲关键词不能为空' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const upstream = `${getSeekendApiBaseUrl()}/image/song`

  try {
    // 过并发闸；超时用 AbortSignal.timeout，从真正发起上游请求时才开始计时（排队时间不计入）
    const res = await upstreamGate.run(() =>
      fetch(upstream, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: '*/*' },
        body: JSON.stringify({ ...rawBody, ...ctx.authBody, song }),
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
