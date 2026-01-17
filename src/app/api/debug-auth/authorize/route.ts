import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COOKIE_NAME = 'phigros_debug_auth'
const COOKIE_MAX_AGE_SECONDS = 10 * 60

type JsonResponse = { success: true } | { success: false; error: string }

function isDebugAuthEnabled(): boolean {
  // 说明：为避免误开启后被外部探测，生产环境需显式设置 DEBUG_AUTH_ENABLED=1 才允许启用。
  // 开发环境放宽限制，便于本地排障。
  return process.env.NODE_ENV !== 'production' || process.env.DEBUG_AUTH_ENABLED === '1'
}

function normalizeKey(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function readKeyFromRequest(request: Request): Promise<string> {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => null)) as unknown
    if (body && typeof body === 'object') {
      const key = (body as Record<string, unknown>).key
      return normalizeKey(key)
    }
    return ''
  }

  // 兼容 <form method="post"> 提交：避免 key 出现在 URL
  const form = await request.formData().catch(() => null)
  if (!form) return ''
  return normalizeKey(form.get('key'))
}

function safeRedirectUrl(request: Request): URL {
  // 说明：仅允许跳回 /debug-auth，避免 open redirect。
  return new URL('/debug-auth', request.url)
}

export async function POST(request: Request) {
  // 安全：禁止任何缓存层缓存授权结果（包含 Set-Cookie）。
  const baseHeaders = { 'Cache-Control': 'no-store' }

  const enabled = isDebugAuthEnabled()
  const requiredKey = (process.env.DEBUG_AUTH_ACCESS_KEY || '').trim()
  if (!enabled || !requiredKey) {
    // 对外表现为 404，降低被探测的可见性
    return NextResponse.json({ success: false, error: 'Not Found' } satisfies JsonResponse, {
      status: 404,
      headers: baseHeaders,
    })
  }

  const key = await readKeyFromRequest(request)
  const ok = key === requiredKey

  const accept = request.headers.get('accept') || ''
  const wantsHtml = accept.includes('text/html')

  if (!ok) {
    if (wantsHtml) {
      // 说明：失败时不回显原因，避免把“路由是否存在/是否启用”等信息暴露给外部探测。
      const url = safeRedirectUrl(request)
      url.searchParams.set('auth', 'failed')
      return NextResponse.redirect(url, { status: 303, headers: baseHeaders })
    }

    return NextResponse.json({ success: false, error: 'Unauthorized' } satisfies JsonResponse, {
      status: 401,
      headers: baseHeaders,
    })
  }

  if (wantsHtml) {
    const res = NextResponse.redirect(safeRedirectUrl(request), { status: 303, headers: baseHeaders })
    res.cookies.set(COOKIE_NAME, '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/debug-auth',
      maxAge: COOKIE_MAX_AGE_SECONDS,
    })
    return res
  }

  const res = NextResponse.json({ success: true } satisfies JsonResponse, { headers: baseHeaders })
  res.cookies.set(COOKIE_NAME, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/debug-auth',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
  return res
}

