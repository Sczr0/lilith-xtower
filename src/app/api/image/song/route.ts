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
 * /api/image/song（需要鉴权）
 * - body: { song }
 */
export async function POST(request: NextRequest) {
  const ctx = await getSessionAuthContext()
  if (!ctx) return jsonError('未登录', 401)

  const rawBody = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const song = typeof rawBody.song === 'string' ? rawBody.song.trim() : ''
  if (!song) return jsonError('歌曲关键词不能为空', 400)

  const upstream = `${getSeekendApiBaseUrl()}/image/song`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: '*/*' },
      body: JSON.stringify({ ...rawBody, ...ctx.authBody, song }),
      cache: 'no-store',
      signal: controller.signal,
    })

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
    return jsonError(isTimeout ? '请求超时，请稍后重试' : '请求失败，请稍后重试', isTimeout ? 504 : 502)
  } finally {
    clearTimeout(timeout)
  }
}

