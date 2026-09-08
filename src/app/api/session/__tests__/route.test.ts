import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/lib/auth/session', () => ({
  getAuthSession: vi.fn(),
}))

import { getAuthSession } from '@/app/lib/auth/session'
import { GET } from '../route'

/**
 * 回归用例（P0-2）：/api/session 是「会话状态」接口，不是「后端 token 校验」接口。
 * 它必须完全本地判定（只读 Cookie + 撤销表），不得因为上游抽风而变慢或报 5xx——
 * 否则客户端会把「查不到」当成「未登录」，出现 /dashboard ↔ /login 来回跳转。
 */
describe('api/session', () => {
  const mockGetAuthSession = vi.mocked(getAuthSession)

  beforeEach(() => {
    mockGetAuthSession.mockReset()
  })

  it('未登录时返回未认证基线负载', async () => {
    mockGetAuthSession.mockResolvedValue({ credential: undefined } as never)

    const res = await GET()

    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await res.json()
    expect(body.isAuthenticated).toBe(false)
    expect(body.credential).toBe(null)
    expect(body.taptapVersion).toBe(null)
    expect(body.consentRequired).toBe(false)
    expect(body.acceptedAgreementVersion).toBe(null)
    expect(body.acceptedPrivacyVersion).toBe(null)
    expect(typeof body.requiredAgreementVersion).toBe('string')
    expect(typeof body.requiredPrivacyVersion).toBe('string')
  })

  it('存在本地会话时直接返回已登录（不依赖上游 token 校验）', async () => {
    mockGetAuthSession.mockResolvedValue({
      credential: { type: 'session', token: 'token_plain', timestamp: 1700000000000 },
      taptapVersion: 'cn',
    } as never)

    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isAuthenticated).toBe(true)
    expect(body.credential).toEqual({
      type: 'session',
      timestamp: 1700000000000,
      tokenMasked: '****',
    })
    expect(body.taptapVersion).toBe('cn')
    // 未同意任何版本时，consentRequired 应为 true。
    expect(body.consentRequired).toBe(true)
    expect(body.acceptedAgreementVersion).toBe(null)
    expect(body.acceptedPrivacyVersion).toBe(null)
  })

  it('读取会话异常时返回 500 且不泄露内部细节之外的字段', async () => {
    mockGetAuthSession.mockRejectedValue(new Error('boom'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await GET()
    errorSpy.mockRestore()

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.isAuthenticated).toBe(false)
    expect(body.credential).toBe(null)
  })
})
