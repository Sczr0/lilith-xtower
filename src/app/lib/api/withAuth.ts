import { NextRequest, NextResponse } from 'next/server'
import { getSessionAuthContext, type SessionAuthContext } from '@/app/lib/auth/sessionAuthContext'

export type AuthedRequestHandler = (
  req: NextRequest,
  ctx: SessionAuthContext,
) => Promise<NextResponse>

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

/**
 * 统一鉴权包装：校验登录态后执行业务逻辑，未登录返回 401。
 */
export function withAuth(handler: AuthedRequestHandler) {
  return async (req: NextRequest) => {
    const ctx = await getSessionAuthContext()
    if (!ctx) return jsonError('未登录', 401)
    return handler(req, ctx)
  }
}
