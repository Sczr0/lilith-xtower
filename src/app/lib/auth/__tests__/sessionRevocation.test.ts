import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isAuthSessionRevoked,
  isCredentialRevoked,
  resetAuthSessionRevocationsForTest,
  revokeAuthSession,
  revokeCredential,
} from '../sessionRevocation'

describe('sessionRevocation', () => {
  beforeEach(() => {
    resetAuthSessionRevocationsForTest()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-09T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    resetAuthSessionRevocationsForTest()
  })

  it('returns false for empty key or invalid ttl', () => {
    revokeAuthSession('', 1_000)
    revokeAuthSession('   ', 1_000)
    revokeAuthSession('sid:test', 0)
    revokeAuthSession('sid:test', -1)

    expect(isAuthSessionRevoked('')).toBe(false)
    expect(isAuthSessionRevoked('sid:test')).toBe(false)
  })

  it('marks key as revoked before ttl expires', () => {
    revokeAuthSession('sid:test', 10_000)

    expect(isAuthSessionRevoked('sid:test')).toBe(true)

    vi.advanceTimersByTime(9_999)
    expect(isAuthSessionRevoked('sid:test')).toBe(true)
  })

  it('expires revocation record after ttl', () => {
    revokeAuthSession('sid:test', 5_000)
    vi.advanceTimersByTime(5_001)

    expect(isAuthSessionRevoked('sid:test')).toBe(false)
  })

  it('credential watermark invalidates sessions issued before invalidBefore', () => {
    const watermark = Date.now()
    revokeCredential('cred:user-1', watermark, 60_000)

    expect(isCredentialRevoked('cred:user-1', watermark - 1)).toBe(true)
    expect(isCredentialRevoked('cred:user-1', watermark)).toBe(false)
    expect(isCredentialRevoked('cred:user-1', watermark + 1)).toBe(false)
    expect(isCredentialRevoked('cred:other', watermark - 1)).toBe(false)
  })

  it('credential watermark expires after ttl', () => {
    revokeCredential('cred:user-2', Date.now(), 5_000)
    vi.advanceTimersByTime(5_001)

    expect(isCredentialRevoked('cred:user-2', 0)).toBe(false)
  })

  it('credential watermark only moves forward', () => {
    revokeCredential('cred:user-3', 1_000, 60_000)
    revokeCredential('cred:user-3', 500, 60_000) // 回退请求应被忽略

    expect(isCredentialRevoked('cred:user-3', 800)).toBe(true) // 800 < 1000
    expect(isCredentialRevoked('cred:user-3', 1_200)).toBe(false)
  })
})

