import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { guardBackendSession } from '@/app/lib/auth/backendSessionGuard'
import { getAuthSession } from '@/app/lib/auth/session'

import { POST } from '../route'

vi.mock('@/app/lib/auth/session', () => ({ getAuthSession: vi.fn() }))
vi.mock('@/app/lib/auth/backendSessionGuard', () => ({ guardBackendSession: vi.fn() }))
vi.mock('@/app/lib/auth/upstream', () => ({
  getSeekendApiBaseUrl: () => 'https://backend.test/api/v1',
}))

const REQUEST_ID = '11111111-1111-4111-8111-111111111111'

function request(body: unknown, origin = 'https://lilith.test') {
  return new NextRequest('https://lilith.test/api/delegations/consent', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      'sec-fetch-site': origin === 'https://lilith.test' ? 'same-origin' : 'cross-site',
    },
    body: JSON.stringify(body),
  })
}

describe('delegation consent BFF', () => {
  beforeEach(() => {
    vi.mocked(getAuthSession).mockResolvedValue({
      credential: { type: 'session', token: 'r:test', timestamp: 1 },
      backendAccessToken: 'backend-token',
    } as never)
    vi.mocked(guardBackendSession).mockResolvedValue({ status: 'valid' })
  })

  it('rejects cross-site requests', async () => {
    const response = await POST(request({ request_id: REQUEST_ID, decision: 'approve' }, 'https://evil.test'))
    expect(response.status).toBe(403)
  })

  it('rejects an unauthenticated session', async () => {
    vi.mocked(getAuthSession).mockResolvedValue({} as never)
    const response = await POST(request({ request_id: REQUEST_ID, decision: 'approve' }))
    expect(response.status).toBe(401)
  })

  it('returns the upstream approval redirect', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ redirect_url: 'https://re0auth.test/cb?code=abc' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(request({ request_id: REQUEST_ID, decision: 'approve' }))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      redirect_url: 'https://re0auth.test/cb?code=abc',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      `https://backend.test/api/v1/delegations/requests/${REQUEST_ID}/approve`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer backend-token' }),
      }),
    )
  })

  it('returns the upstream deny Location', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 307,
          headers: { location: 'https://re0auth.test/cb?error=access_denied' },
        }),
      ),
    )

    const response = await POST(request({ request_id: REQUEST_ID, decision: 'deny' }))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      redirect_url: 'https://re0auth.test/cb?error=access_denied',
    })
  })
})
