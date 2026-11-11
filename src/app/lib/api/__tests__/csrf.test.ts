import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { isSameOrigin } from '../csrf'

function request(headers: Record<string, string>, url = 'https://app.test/api/delegations/consent') {
  return new NextRequest(url, { method: 'POST', headers })
}

describe('isSameOrigin', () => {
  it('accepts a same-origin browser request', () => {
    expect(
      isSameOrigin(
        request({
          origin: 'https://app.test',
          'sec-fetch-site': 'same-origin',
        }),
      ),
    ).toBe(true)
  })

  it('rejects a cross-site fetch even when Origin is spoofed', () => {
    expect(
      isSameOrigin(
        request({
          origin: 'https://app.test',
          'sec-fetch-site': 'cross-site',
        }),
      ),
    ).toBe(false)
  })

  it('rejects a different origin', () => {
    expect(isSameOrigin(request({ origin: 'https://evil.test' }))).toBe(false)
  })

  it('accepts a proxied request using the forwarded host', () => {
    expect(
      isSameOrigin(
        request(
          {
            origin: 'https://app.test',
            'sec-fetch-site': 'same-origin',
            'x-forwarded-host': 'app.test',
          },
          'http://localhost:3000/api/delegations/consent',
        ),
      ),
    ).toBe(true)
  })

  it('falls back to Referer when Origin is absent', () => {
    expect(
      isSameOrigin(request({ referer: 'https://app.test/login?next=/delegations' })),
    ).toBe(true)
  })

  it('rejects a request with neither Origin nor Referer', () => {
    expect(isSameOrigin(request({}))).toBe(false)
  })
})
