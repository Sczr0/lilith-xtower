import { describe, expect, it } from 'vitest'

import { buildGoHref, normalizeExternalWebUrl, parseGoUrlParam } from '../outbound'

describe('utils/outbound', () => {
  it('normalizeExternalWebUrl: 仅识别 http/https/协议相对', () => {
    expect(normalizeExternalWebUrl('https://example.com')).toBe('https://example.com')
    expect(normalizeExternalWebUrl('http://example.com')).toBe('http://example.com')
    expect(normalizeExternalWebUrl('HTTPS://example.com')).toBe('HTTPS://example.com')
    expect(normalizeExternalWebUrl('//example.com/a')).toBe('https://example.com/a')
    expect(normalizeExternalWebUrl('  https://example.com  ')).toBe('https://example.com')

    expect(normalizeExternalWebUrl('/about')).toBe(null)
    expect(normalizeExternalWebUrl('mailto:test@example.com')).toBe(null)
    expect(normalizeExternalWebUrl('tel:+10086')).toBe(null)
  })

  it('buildGoHref: 将外部链接包装为 /go?url=...', () => {
    expect(buildGoHref('https://example.com/a?x=1&y=2')).toBe(
      `/go?url=${encodeURIComponent('https://example.com/a?x=1&y=2')}`,
    )
    expect(buildGoHref('//example.com')).toBe(`/go?url=${encodeURIComponent('https://example.com')}`)
    expect(buildGoHref('/about')).toBe(null)
  })

  it('parseGoUrlParam: 校验 url 参数并拒绝危险协议', () => {
    expect(parseGoUrlParam(undefined)).toEqual({ ok: false, reason: 'missing' })
    expect(parseGoUrlParam('not a url')).toEqual({ ok: false, reason: 'invalid' })
    expect(parseGoUrlParam('javascript:alert(1)')).toEqual({ ok: false, reason: 'unsupported-protocol' })
    expect(parseGoUrlParam(encodeURIComponent('javascript:alert(1)'))).toEqual({
      ok: false,
      reason: 'unsupported-protocol',
    })

    const ok = parseGoUrlParam('https://example.com')
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.url.origin).toBe('https://example.com')
      expect(ok.normalized).toBe('https://example.com/')
    }

    const okEncoded = parseGoUrlParam(encodeURIComponent('https://example.com/a?x=1&y=2'))
    expect(okEncoded.ok).toBe(true)
    if (okEncoded.ok) {
      expect(okEncoded.normalized).toBe('https://example.com/a?x=1&y=2')
    }

    const okDoubleEncoded = parseGoUrlParam(encodeURIComponent(encodeURIComponent('https://example.com/a')))
    expect(okDoubleEncoded.ok).toBe(true)
    if (okDoubleEncoded.ok) {
      expect(okDoubleEncoded.normalized).toBe('https://example.com/a')
    }

    const okProtocolRelativeEncoded = parseGoUrlParam(encodeURIComponent('//example.com/a'))
    expect(okProtocolRelativeEncoded.ok).toBe(true)
    if (okProtocolRelativeEncoded.ok) {
      expect(okProtocolRelativeEncoded.normalized).toBe('https://example.com/a')
    }

    const okArr = parseGoUrlParam(['https://example.com/a'])
    expect(okArr.ok).toBe(true)
    if (okArr.ok) {
      expect(okArr.normalized).toBe('https://example.com/a')
    }
  })
})
