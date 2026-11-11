// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'

import { consumePostLoginRedirect, isSafeNext, rememberPostLoginRedirect } from '../postLoginRedirect'

describe('postLoginRedirect', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('accepts only same-site relative paths', () => {
    expect(isSafeNext('/delegations/consent?request_id=x')).toBe(true)
    expect(isSafeNext('//evil.test/path')).toBe(false)
    expect(isSafeNext('/\\evil.test')).toBe(false)
    expect(isSafeNext('https://evil.test')).toBe(false)
    expect(isSafeNext(null)).toBe(false)
  })

  it('remembers and consumes a safe redirect once', () => {
    rememberPostLoginRedirect('/delegations/consent?request_id=x')
    expect(consumePostLoginRedirect()).toBe('/delegations/consent?request_id=x')
    expect(consumePostLoginRedirect()).toBe('/dashboard')
  })

  it('falls back to dashboard for an unsafe value', () => {
    rememberPostLoginRedirect('//evil.test')
    expect(consumePostLoginRedirect()).toBe('/dashboard')
  })
})
