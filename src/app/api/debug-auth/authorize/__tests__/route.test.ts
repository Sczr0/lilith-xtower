import { afterEach, describe, expect, it } from 'vitest'

import { POST } from '../route'

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>) {
  const prev: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k]
    if (v === undefined) {
      delete process.env[k]
    } else {
      process.env[k] = v
    }
  }
  return fn().finally(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })
}

describe('api/debug-auth/authorize', () => {
  afterEach(() => {
    // 兜底：避免误留环境变量影响其他测试
    delete process.env.DEBUG_AUTH_ENABLED
    delete process.env.DEBUG_AUTH_ACCESS_KEY
  })

  it('returns 404 when access key is not configured', async () => {
    await withEnv({ DEBUG_AUTH_ENABLED: '1', DEBUG_AUTH_ACCESS_KEY: undefined }, async () => {
      const req = new Request('http://localhost/api/debug-auth/authorize', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'anything' }),
      })

      const res = await POST(req)
      expect(res.status).toBe(404)
      expect(res.headers.get('cache-control')).toBe('no-store')
    })
  })

  it('returns 401 for wrong key (json request)', async () => {
    await withEnv({ DEBUG_AUTH_ENABLED: '1', DEBUG_AUTH_ACCESS_KEY: 'secret' }, async () => {
      const req = new Request('http://localhost/api/debug-auth/authorize', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'wrong' }),
      })

      const res = await POST(req)
      expect(res.status).toBe(401)
      expect(res.headers.get('cache-control')).toBe('no-store')

      const body = await res.json()
      expect(body.success).toBe(false)
    })
  })

  it('sets HttpOnly cookie on success (json request)', async () => {
    await withEnv({ DEBUG_AUTH_ENABLED: '1', DEBUG_AUTH_ACCESS_KEY: 'secret' }, async () => {
      const req = new Request('http://localhost/api/debug-auth/authorize', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'secret' }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(res.headers.get('cache-control')).toBe('no-store')

      const setCookie = res.headers.get('set-cookie') || ''
      expect(setCookie).toContain('phigros_debug_auth=1')
      expect(setCookie.toLowerCase()).toContain('httponly')
      expect(setCookie).toContain('Max-Age=600')
      expect(setCookie).toContain('Path=/debug-auth')
    })
  })

  it('redirects and sets cookie on success (form submission)', async () => {
    await withEnv({ DEBUG_AUTH_ENABLED: '1', DEBUG_AUTH_ACCESS_KEY: 'secret' }, async () => {
      const req = new Request('http://localhost/api/debug-auth/authorize', {
        method: 'POST',
        headers: { Accept: 'text/html', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ key: 'secret' }),
      })

      const res = await POST(req)
      expect(res.status).toBe(303)
      expect(res.headers.get('location')).toBe('http://localhost/debug-auth')
      expect(res.headers.get('cache-control')).toBe('no-store')

      const setCookie = res.headers.get('set-cookie') || ''
      expect(setCookie).toContain('phigros_debug_auth=1')
    })
  })
})

