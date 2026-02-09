import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/auth/session', () => ({
  getAuthSession: vi.fn(),
  getAuthSessionTtlMs: vi.fn(),
  getSessionRevocationKey: vi.fn(),
}))

vi.mock('@/app/lib/auth/phi-session', () => ({
  logoutBackendToken: vi.fn(),
}))

vi.mock('@/app/lib/auth/sessionRevocation', () => ({
  revokeAuthSession: vi.fn(),
}))

import { getAuthSession, getAuthSessionTtlMs, getSessionRevocationKey } from '@/app/lib/auth/session'
import { logoutBackendToken } from '@/app/lib/auth/phi-session'
import { revokeAuthSession } from '@/app/lib/auth/sessionRevocation'
import { POST } from '../route'

describe('api/session/logout', () => {
  const mockGetAuthSession = vi.mocked(getAuthSession)
  const mockGetAuthSessionTtlMs = vi.mocked(getAuthSessionTtlMs)
  const mockGetSessionRevocationKey = vi.mocked(getSessionRevocationKey)
  const mockLogoutBackendToken = vi.mocked(logoutBackendToken)
  const mockRevokeAuthSession = vi.mocked(revokeAuthSession)

  beforeEach(() => {
    mockGetAuthSession.mockReset()
    mockGetAuthSessionTtlMs.mockReset()
    mockGetSessionRevocationKey.mockReset()
    mockLogoutBackendToken.mockReset()
    mockRevokeAuthSession.mockReset()
    mockGetAuthSessionTtlMs.mockReturnValue(30_000)
  })

  it('revokes local session key and destroys session on logout', async () => {
    const destroy = vi.fn()
    mockGetAuthSession.mockResolvedValue({
      backendAccessToken: 'backend-token',
      destroy,
    } as never)
    mockGetSessionRevocationKey.mockReturnValue('sid:abc')

    const request = { json: vi.fn().mockResolvedValue({ scope: 'all' }) }
    const response = await POST(request as never)

    expect(mockLogoutBackendToken).toHaveBeenCalledWith('backend-token', 'all')
    expect(mockGetSessionRevocationKey).toHaveBeenCalledTimes(1)
    expect(mockRevokeAuthSession).toHaveBeenCalledWith('sid:abc', 30_000)
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ success: true, scope: 'all' })
  })

  it('continues local logout when backend logout fails', async () => {
    const destroy = vi.fn()
    mockGetAuthSession.mockResolvedValue({
      backendAccessToken: 'backend-token',
      destroy,
    } as never)
    mockGetSessionRevocationKey.mockReturnValue('sid:abc')
    mockLogoutBackendToken.mockRejectedValue(new Error('backend down'))

    const request = { json: vi.fn().mockResolvedValue({}) }
    const response = await POST(request as never)

    expect(mockLogoutBackendToken).toHaveBeenCalledWith('backend-token', 'current')
    expect(mockRevokeAuthSession).toHaveBeenCalledWith('sid:abc', 30_000)
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, scope: 'current' })
  })

  it('does not write revocation when key is absent', async () => {
    const destroy = vi.fn()
    mockGetAuthSession.mockResolvedValue({ destroy } as never)
    mockGetSessionRevocationKey.mockReturnValue(null)

    const request = { json: vi.fn().mockRejectedValue(new Error('bad json')) }
    const response = await POST(request as never)

    expect(mockLogoutBackendToken).not.toHaveBeenCalled()
    expect(mockRevokeAuthSession).not.toHaveBeenCalled()
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, scope: 'current' })
  })
})

