import { describe, expect, it } from 'vitest'

import { stringifyJsonForDisplay } from '../redactJson'

describe('utils/redactJson', () => {
  it('redacts common sensitive keys by default', () => {
    const out = stringifyJsonForDisplay({
      token: 'abcdefghijklmnopqrstuvwxyz0123456789',
      api_token: 'abcdefghijklmnopqrstuvwxyz0123456789',
      password: 'p@ssw0rd!!',
      safe: 'hello',
    })

    expect(out).toContain('"token": "abcdef…6789"')
    expect(out).toContain('"api_token": "abcdef…6789"')
    expect(out).toContain('"password": "****"')
    expect(out).toContain('"safe": "hello"')
  })

  it('keeps original values when redacted=false', () => {
    const out = stringifyJsonForDisplay({ token: 'abcdefghijklmnopqrstuvwxyz0123456789' }, { redacted: false })
    expect(out).toContain('"token": "abcdefghijklmnopqrstuvwxyz0123456789"')
  })

  it('handles circular references', () => {
    const obj: { self?: unknown; token?: string } = { token: 'abcdefghijklmnopqrstuvwxyz0123456789' }
    obj.self = obj

    const out = stringifyJsonForDisplay(obj)
    expect(out).toContain('"self": "[Circular]"')
  })
})

