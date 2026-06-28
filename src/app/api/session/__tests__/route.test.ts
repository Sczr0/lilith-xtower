import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/auth/session', () => ({
  getAuthSession: vi.fn(),
}))

vi.mock('@/app/lib/auth/backendSessionGuard', () => ({
  guardBackendSession: vi.fn(),
}))

import { guardBackendSession } from '@/app/lib/auth/backendSessionGuard'
import { getAuthSession } from '@/app/lib/auth/session'
import { GET } from '../route'

describe('api/session', () => {
  const mockGetAuthSession = vi.mocked(getAuthSession)
  const mockGuardBackendSession = vi.mocked(guardBackendSession)

  beforeEach(() => {
    mockGetAuthSession.mockReset()
    mockGuardBackendSession.mockReset()
  })

  it('calls guard with lazy mode for status endpoint', async () => {
    const session = { credential: undefined }
    mockGetAuthSession.mockResolvedValue(session as never)
    mockGuardBackendSession.mockResolvedValue({ status: 'invalid', reason: 'missing_token' })

    await GET()

    expect(mockGuardBackendSession).toHaveBeenCalledWith(session, { mode: 'lazy' })
  })

  it('returns unauthenticated when backend token is missing/invalid', async () => {
    mockGetAuthSession.mockResolvedValue({ credential: undefined } as never)
    mockGuardBackendSession.mockResolvedValue({ status: 'invalid', reason: 'missing_token' })

    const res = await GET()

    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await res.json()
    expect(body.isAuthenticated).toBe(false)
    expect(body.credential).toBe(null)
    expect(body.taptapVersion).toBe(null)
    expect(body.consentRequired).toBe(false)
    expect(body.acceptedAgreementVersion).toBe(null)
    expect(body.acceptedPrivacyVersion).toBe(null)
    expect(typeof body.requiredAgreementVersion).toBe('string')
    expect(typeof body.requiredPrivacyVersion).toBe('string')
  })

  it('returns 502 when backend validation upstream fails', async () => {
    mockGetAuthSession.mockResolvedValue({ credential: undefined } as never)
    mockGuardBackendSession.mockResolvedValue({ status: 'upstream_error', message: 'refresh failed: 503' })

    const res = await GET()

    expect(res.status).toBe(502)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await res.json()
    expect(body.isAuthenticated).toBe(false)
    expect(body.consentRequired).toBe(false)
    expect(body.error).toBe('会话校验失败，请稍后重试')
  })

  it('returns authenticated status only after backend validation success', async () => {
    mockGetAuthSession.mockResolvedValue({
      credential: { type: 'session', token: 'token_plain', timestamp: 1700000000000 },
      taptapVersion: 'cn',
    } as never)
    mockGuardBackendSession.mockResolvedValue({ status: 'valid' })

    const res = await GET()

    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await res.json()
    expect(body.isAuthenticated).toBe(true)
    expect(body.credential).toEqual({
      type: 'session',
      timestamp: 1700000000000,
      tokenMasked: '****',
    })
    expect(body.taptapVersion).toBe('cn')
    // 未同意任何版本时，consentRequired 应为 true。
    expect(body.consentRequired).toBe(true)
    expect(body.acceptedAgreementVersion).toBe(null)
    expect(body.acceptedPrivacyVersion).toBe(null)
  })
})
