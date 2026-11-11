import { NextRequest, NextResponse } from 'next/server'

import { isSameOrigin } from '@/app/lib/api/csrf'
import { guardBackendSession } from '@/app/lib/auth/backendSessionGuard'
import { getAuthSession } from '@/app/lib/auth/session'
import { getSeekendApiBaseUrl } from '@/app/lib/auth/upstream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return jsonNoStore({ message: '跨站请求被拒绝' }, 403)
  }

  const contentType = request.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return jsonNoStore({ message: '请求格式无效' }, 415)
  }

  const body = (await request.json().catch(() => null)) as
    | { request_id?: unknown; decision?: unknown }
    | null
  const requestId = typeof body?.request_id === 'string' ? body.request_id : ''
  const decision = body?.decision
  if (!REQUEST_ID.test(requestId) || (decision !== 'approve' && decision !== 'deny')) {
    return jsonNoStore({ message: '授权请求参数无效' }, 400)
  }

  const session = await getAuthSession()
  if (!session.credential) {
    return jsonNoStore({ message: '请先登录' }, 401)
  }

  const guarded = await guardBackendSession(session, { mode: 'lazy' })
  if (guarded.status === 'invalid') {
    return jsonNoStore({ message: '登录已失效，请重新登录' }, 401)
  }
  if (guarded.status === 'upstream_error') {
    return jsonNoStore({ message: '上游暂时不可用' }, 502)
  }

  const accessToken = session.backendAccessToken?.trim()
  if (!accessToken) {
    return jsonNoStore({ message: '缺少后端会话令牌' }, 401)
  }

  const upstream = `${getSeekendApiBaseUrl()}/delegations/requests/${encodeURIComponent(requestId)}/${decision}`
  let response: Response
  try {
    response = await fetch(upstream, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    return jsonNoStore({ message: '上游请求超时或不可达' }, 502)
  }

  if (decision === 'deny') {
    const location = response.headers.get('location')
    if (!location) {
      return jsonNoStore({ message: '上游未返回拒绝跳转地址' }, 502)
    }
    return jsonNoStore({ redirect_url: location })
  }

  if (!response.ok) {
    return jsonNoStore({ message: '授权请求已失效或已处理' }, response.status)
  }

  const payload = (await response.json().catch(() => null)) as { redirect_url?: unknown } | null
  if (typeof payload?.redirect_url !== 'string' || !payload.redirect_url) {
    return jsonNoStore({ message: '上游未返回授权回调地址' }, 502)
  }

  return jsonNoStore({ redirect_url: payload.redirect_url })
}
