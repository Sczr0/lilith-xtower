import type { NextRequest } from 'next/server'

/**
 * Consent 是长期授权动作，必须有同源校验；SameSite=Lax 不能覆盖顶层 POST 之外的
 * 同站子域/代理场景。优先看 Sec-Fetch-Site，其次比对 Origin/Referer。
 */
export function isSameOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return false
  }

  const expected = new URL(request.url).origin
  const origin = request.headers.get('origin')
  if (origin) return origin === expected

  const referer = request.headers.get('referer')
  if (!referer) return false
  try {
    return new URL(referer).origin === expected
  } catch {
    return false
  }
}
