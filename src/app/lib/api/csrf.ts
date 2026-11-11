import type { NextRequest } from 'next/server'

/**
 * Consent 是长期授权动作，必须有同源校验；SameSite=Lax 不能覆盖顶层 POST 之外的
 * 同站子域/代理场景。优先看 Sec-Fetch-Site，其次比对 Origin/Referer。
 */
/**
 * 代理后的 `request.url` 可能仍是容器内地址（如 http://localhost:3000），
 * 同源判断应以转发链给出的 Host 为准。
 */
function requestHost(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  return request.headers.get('host')?.trim() || new URL(request.url).host
}

function sameHost(value: string, request: NextRequest): boolean {
  try {
    return new URL(value).host === requestHost(request)
  } catch {
    return false
  }
}

export function isSameOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return false
  }

  const origin = request.headers.get('origin')
  if (origin) return sameHost(origin, request)

  const referer = request.headers.get('referer')
  if (!referer) return false
  return sameHost(referer, request)
}
