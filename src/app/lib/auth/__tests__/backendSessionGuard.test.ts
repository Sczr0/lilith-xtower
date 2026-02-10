import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRefreshBackendToken, mockIsBackendSessionError } = vi.hoisted(() => ({
  mockRefreshBackendToken: vi.fn(),
  mockIsBackendSessionError: vi.fn(),
}))

vi.mock('../phi-session', () => ({
  refreshBackendToken: mockRefreshBackendToken,
  isBackendSessionError: mockIsBackendSessionError,
}))

import { guardBackendSession } from '../backendSessionGuard'

describe('backendSessionGuard', () => {
  beforeEach(() => {
    mockRefreshBackendToken.mockReset()
    mockIsBackendSessionError.mockReset()
  })

  it('returns invalid when backend token is missing', async () => {
    const session = {
      save: vi.fn(),
      destroy: vi.fn(),
    }

    const result = await guardBackendSession(session as never)

    expect(result).toEqual({ status: 'invalid', reason: 'missing_token' })
    expect(session.save).not.toHaveBeenCalled()
    expect(session.destroy).not.toHaveBeenCalled()
  })

  it('refreshes token and saves session when backend token is valid', async () => {
    const session = {
      backendAccessToken: 'old-token',
      save: vi.fn(),
      destroy: vi.fn(),
    }

    mockRefreshBackendToken.mockResolvedValue({
      accessToken: 'new-token',
      expiresIn: 900,
      tokenType: 'Bearer',
    })

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
    const result = await guardBackendSession(session as never)
    nowSpy.mockRestore()

    expect(result).toEqual({ status: 'valid' })
    expect(session.backendAccessToken).toBe('new-token')
    expect(session.backendExpAt).toBe(1700000900000)
    expect(session.save).toHaveBeenCalledTimes(1)
    expect(session.destroy).not.toHaveBeenCalled()
  })

  it('destroys session when refresh returns backend 401', async () => {
    const session = {
      backendAccessToken: 'old-token',
      backendExpAt: 1700000900000,
      save: vi.fn(),
      destroy: vi.fn(),
    }

    const error = { status: 401 }
    mockRefreshBackendToken.mockRejectedValue(error)
    mockIsBackendSessionError.mockImplementation((value: unknown) => value === error)

    const result = await guardBackendSession(session as never)

    expect(result).toEqual({ status: 'invalid', reason: 'token_rejected' })
    expect(session.backendAccessToken).toBeUndefined()
    expect(session.backendExpAt).toBeUndefined()
    expect(session.destroy).toHaveBeenCalledTimes(1)
    expect(session.save).not.toHaveBeenCalled()
  })

  it('returns upstream error when refresh fails with non-401', async () => {
    const session = {
      backendAccessToken: 'old-token',
      save: vi.fn(),
      destroy: vi.fn(),
    }

    const error = new Error('refresh failed: 503')
    mockRefreshBackendToken.mockRejectedValue(error)
    mockIsBackendSessionError.mockReturnValue(false)

    const result = await guardBackendSession(session as never)

    expect(result).toEqual({ status: 'upstream_error', message: 'refresh failed: 503' })
    expect(session.save).not.toHaveBeenCalled()
    expect(session.destroy).not.toHaveBeenCalled()
  })

  it('skips refresh in lazy mode when token is not close to expiration', async () => {
    const session = {
      backendAccessToken: 'cached-token',
      backendExpAt: 1700003600000,
      save: vi.fn(),
      destroy: vi.fn(),
    }

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
    const result = await guardBackendSession(session as never, { mode: 'lazy', refreshWindowMs: 60_000 })
    nowSpy.mockRestore()

    expect(result).toEqual({ status: 'valid' })
    expect(mockRefreshBackendToken).not.toHaveBeenCalled()
    expect(session.save).not.toHaveBeenCalled()
    expect(session.destroy).not.toHaveBeenCalled()
  })

  it('always refreshes in strict mode even when token has long ttl', async () => {
    const session = {
      backendAccessToken: 'old-token',
      backendExpAt: 1700003600000,
      save: vi.fn(),
      destroy: vi.fn(),
    }

    mockRefreshBackendToken.mockResolvedValue({
      accessToken: 'new-token',
      expiresIn: 900,
      tokenType: 'Bearer',
    })

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
    const result = await guardBackendSession(session as never, { mode: 'strict' })
    nowSpy.mockRestore()

    expect(result).toEqual({ status: 'valid' })
    expect(mockRefreshBackendToken).toHaveBeenCalledTimes(1)
    expect(session.backendAccessToken).toBe('new-token')
    expect(session.save).toHaveBeenCalledTimes(1)
  })
})
