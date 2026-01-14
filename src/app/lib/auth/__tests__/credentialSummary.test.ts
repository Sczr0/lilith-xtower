import { describe, expect, it } from 'vitest'

import type { AuthCredential } from '../../types/auth'
import { toCredentialSummary } from '../credentialSummary'

describe('lib/auth/credentialSummary', () => {
  it('never exposes raw session token', () => {
    const credential: AuthCredential = {
      type: 'session',
      token: 'abcdefghijklmnopqrstuvwxyz0123456789',
      timestamp: 1700000000000,
    }

    const summary = toCredentialSummary(credential)
    expect(summary.type).toBe('session')
    expect('token' in (summary as unknown as Record<string, unknown>)).toBe(false)
    expect(summary.tokenMasked).not.toContain(credential.token)
    expect(summary.tokenMasked).not.toBe(credential.token)
  })

  it('never exposes raw api token', () => {
    const credential: AuthCredential = {
      type: 'api',
      api_user_id: 'internal_id_123',
      api_token: 'abcdefghijklmnopqrstuvwxyz0123456789',
      timestamp: 1700000000000,
    }

    const summary = toCredentialSummary(credential)
    expect(summary.type).toBe('api')
    expect(summary.api_user_id).toBe('internal_id_123')
    expect((summary as { api_token_masked?: string }).api_token_masked).toBeDefined()
    expect((summary as { api_token_masked?: string }).api_token_masked).not.toContain(credential.api_token!)
    expect((summary as { api_token_masked?: string }).api_token_masked).not.toBe(credential.api_token)
    expect(JSON.stringify(summary)).not.toContain('"api_token"')
  })

  it('omits api_token_masked when api_token is missing', () => {
    const credential: AuthCredential = {
      type: 'api',
      api_user_id: 'internal_id_123',
      timestamp: 1700000000000,
    }

    const summary = toCredentialSummary(credential)
    expect(summary.type).toBe('api')
    expect(summary.api_user_id).toBe('internal_id_123')
    expect((summary as { api_token_masked?: string }).api_token_masked).toBeUndefined()
    expect(JSON.stringify(summary)).not.toContain('api_token_masked')
  })

  it('never exposes token-like fields for platform credential', () => {
    const credential: AuthCredential = {
      type: 'platform',
      platform: 'taptap',
      platform_id: 'uid_123',
      timestamp: 1700000000000,
    }

    const summary = toCredentialSummary(credential)
    expect(summary.type).toBe('platform')
    expect(JSON.stringify(summary)).not.toContain('token')
  })
})
