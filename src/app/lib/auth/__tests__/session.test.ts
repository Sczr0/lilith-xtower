import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCookies, mockGetIronSession, mockIsAuthSessionRevoked } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockGetIronSession: vi.fn(),
  mockIsAuthSessionRevoked: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}))

vi.mock('iron-session', () => ({
  getIronSession: mockGetIronSession,
}))

vi.mock('../sessionRevocation', () => ({
  isAuthSessionRevoked: mockIsAuthSessionRevoked,
}))

import {
  ensureAuthSessionKey,
  getAuthSession,
  getAuthSessionTtlMs,
  getSessionRevocationKey,
} from '../session'

describe('auth/session helpers', () => {
  beforeEach(() => {
    mockCookies.mockReset()
    mockGetIronSession.mockReset()
    mockIsAuthSessionRevoked.mockReset()
    mockCookies.mockResolvedValue({})
    process.env.AUTH_SESSION_PASSWORD = '12345678901234567890123456789012'
  })

  it('returns existing sessionKey when present', () => {
    const session = { sessionKey: 'fixed-key' }
    expect(ensureAuthSessionKey(session as never)).toBe('fixed-key')
  })

  it('generates sessionKey when absent', () => {
    const session = {}
    const key = ensureAuthSessionKey(session as never)

    expect(typeof key).toBe('string')
    expect(key.length).toBeGreaterThan(10)
    expect(session).toHaveProperty('sessionKey', key)
  })

  it('builds sid revocation key when sessionKey exists', () => {
    const key = getSessionRevocationKey({
      sessionKey: 'abc',
      credential: undefined,
      createdAt: undefined,
      taptapVersion: undefined,
    })

    expect(key).toBe('sid:abc')
  })

  it('builds legacy revocation key when sessionKey missing', () => {
    const key = getSessionRevocationKey({
      credential: { type: 'api', api_user_id: 'uid', timestamp: 1700000000000 },
      createdAt: 1700000001000,
      taptapVersion: 'cn',
      sessionKey: undefined,
    })

    expect(key).toMatch(/^legacy:[a-f0-9]{16}$/)
  })

  it('returns null legacy key when credential or createdAt missing', () => {
    const key1 = getSessionRevocationKey({
      sessionKey: undefined,
      credential: undefined,
      createdAt: 1700000001000,
      taptapVersion: 'cn',
    })
    const key2 = getSessionRevocationKey({
      sessionKey: undefined,
      credential: { type: 'session', token: 'abc', timestamp: 1700000000000 },
      createdAt: undefined,
      taptapVersion: 'cn',
    })

    expect(key1).toBeNull()
    expect(key2).toBeNull()
  })

  it('exports ttl in milliseconds', () => {
    expect(getAuthSessionTtlMs()).toBe(7 * 24 * 60 * 60 * 1000)
  })
})

describe('getAuthSession revoke integration', () => {
  beforeEach(() => {
    mockCookies.mockReset()
    mockGetIronSession.mockReset()
    mockIsAuthSessionRevoked.mockReset()
    mockCookies.mockResolvedValue({})
    process.env.AUTH_SESSION_PASSWORD = '12345678901234567890123456789012'
  })

  it('destroys session when revocation key is marked revoked', async () => {
    const destroy = vi.fn()
    const session = {
      sessionKey: 'abc',
      credential: { type: 'session', token: 'token_plain', timestamp: 1700000000000 },
      createdAt: 1700000001000,
      taptapVersion: 'cn',
      backendAccessToken: 'backend-token',
      backendExpAt: 1700000010000,
      destroy,
    }

    mockGetIronSession.mockResolvedValue(session)
    mockIsAuthSessionRevoked.mockReturnValue(true)

    const result = await getAuthSession()

    expect(result).toBe(session)
    expect(mockIsAuthSessionRevoked).toHaveBeenCalledWith('sid:abc')
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(session.credential).toBeUndefined()
    expect(session.createdAt).toBeUndefined()
    expect(session.taptapVersion).toBeUndefined()
    expect(session.backendAccessToken).toBeUndefined()
    expect(session.backendExpAt).toBeUndefined()
    expect(session.sessionKey).toBeUndefined()
  })

  it('keeps session when revocation key is not marked revoked', async () => {
    const destroy = vi.fn()
    const session = {
      sessionKey: 'abc',
      credential: { type: 'session', token: 'token_plain', timestamp: 1700000000000 },
      createdAt: 1700000001000,
      taptapVersion: 'cn',
      destroy,
    }

    mockGetIronSession.mockResolvedValue(session)
    mockIsAuthSessionRevoked.mockReturnValue(false)

    const result = await getAuthSession()

    expect(result).toBe(session)
    expect(mockIsAuthSessionRevoked).toHaveBeenCalledWith('sid:abc')
    expect(destroy).not.toHaveBeenCalled()
    expect(session.credential).toBeDefined()
    expect(session.sessionKey).toBe('abc')
  })
})
