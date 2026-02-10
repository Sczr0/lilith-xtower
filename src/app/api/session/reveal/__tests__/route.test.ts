import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/auth/session', () => ({
  getAuthSession: vi.fn(),
}))

vi.mock('@/app/lib/auth/backendSessionGuard', () => ({
  guardBackendSession: vi.fn(),
}))

import { guardBackendSession } from '@/app/lib/auth/backendSessionGuard'
import { getAuthSession } from '@/app/lib/auth/session'
import { POST } from '../route'

describe('api/session/reveal', () => {
  const mockGetAuthSession = vi.mocked(getAuthSession)
  const mockGuardBackendSession = vi.mocked(guardBackendSession)

  beforeEach(() => {
    mockGetAuthSession.mockReset()
    mockGuardBackendSession.mockReset()
  })

  it('returns 401 when backend guard rejects token', async () => {
    mockGetAuthSession.mockResolvedValue({ credential: undefined } as never)
    mockGuardBackendSession.mockResolvedValue({ status: 'invalid', reason: 'token_rejected' })

    const res = await POST()

    expect(res.status).toBe(401)
    expect(res.headers.get('cache-control')).toBe('no-store')

    const body = await res.json()
    expect(body).toEqual({ success: false, error: '未登录' })
  })

  it('returns full credential once when session exists', async () => {
    mockGetAuthSession.mockResolvedValue({
      credential: { type: 'session', token: 'token_plain', timestamp: 1700000000000 },
      taptapVersion: 'cn',
      createdAt: 1700000000123,
    } as never)
    mockGuardBackendSession.mockResolvedValue({ status: 'valid' })

    const res = await POST()

    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.credential).toEqual({ type: 'session', token: 'token_plain', timestamp: 1700000000000 })
    expect(body.taptapVersion).toBe('cn')
    expect(body.createdAt).toBe(1700000000123)
  })

  it('returns 502 when backend guard reports upstream error', async () => {
    mockGetAuthSession.mockResolvedValue({ credential: undefined } as never)
    mockGuardBackendSession.mockResolvedValue({ status: 'upstream_error', message: 'refresh failed: 503' })

    const res = await POST()

    expect(res.status).toBe(502)
    expect(res.headers.get('cache-control')).toBe('no-store')

    const body = await res.json()
    expect(body).toEqual({ success: false, error: '会话校验失败，请稍后重试' })
  })

  it('returns 500 on unexpected error and keeps no-store', async () => {
    mockGetAuthSession.mockRejectedValue(new Error('boom'))
    mockGuardBackendSession.mockResolvedValue({ status: 'valid' })

    const res = await POST()

    expect(res.status).toBe(500)
    expect(res.headers.get('cache-control')).toBe('no-store')

    const body = await res.json()
    expect(body.success).toBe(false)
    expect(String(body.error)).toContain('获取完整凭证失败')
  })
})
