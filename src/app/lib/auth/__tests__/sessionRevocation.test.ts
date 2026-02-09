import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isAuthSessionRevoked,
  resetAuthSessionRevocationsForTest,
  revokeAuthSession,
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
})

