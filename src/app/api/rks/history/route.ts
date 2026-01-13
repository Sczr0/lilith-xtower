import { NextRequest, NextResponse } from 'next/server'

import { getSessionAuthContext } from '@/app/lib/auth/sessionAuthContext'
import { getSeekendApiBaseUrl } from '@/app/lib/auth/upstream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 30_000

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function toInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * /api/rks/history（需要鉴权）
 * - body: { limit, offset }
 */
export async function POST(request: NextRequest) {
  const ctx = await getSessionAuthContext()
  if (!ctx) return jsonError('未登录', 401)

  const rawBody = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const limit = clamp(toInt(rawBody.limit, 50), 1, 100)
  const offset = Math.max(0, toInt(rawBody.offset, 0))

  const upstream = `${getSeekendApiBaseUrl()}/rks/history`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ auth: ctx.authBody, limit, offset }),
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

