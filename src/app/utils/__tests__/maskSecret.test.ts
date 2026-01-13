import { describe, expect, it } from 'vitest'

import { maskSecret } from '../maskSecret'

describe('utils/maskSecret', () => {
  it('returns empty string for empty-ish input', () => {
    expect(maskSecret(undefined)).toBe('')
    expect(maskSecret(null)).toBe('')
    expect(maskSecret('')).toBe('')
  })

  it('masks short secret entirely', () => {
    expect(maskSecret('123')).toBe('****')
    expect(maskSecret('123456789012')).toBe('****')
  })

  it('masks long secret with prefix and suffix', () => {
    expect(maskSecret('1234567890abcdef')).toBe('123456…cdef')
  })
})

