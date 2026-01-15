// @vitest-environment jsdom

import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('../SiteHeader', () => ({
  SiteHeader: () => <div data-testid="site-header" />,
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    credential: { type: 'session', timestamp: 1700000000000, tokenMasked: 'abc…wxyz' },
    isLoading: false,
    error: null,
    logout: vi.fn(),
    validateCurrentCredential: vi.fn(async () => true),
  }),
}))

import { AuthInspectorPage } from '../AuthInspectorPage'

describe('AuthInspectorPage reveal full credential', () => {
  it('fetches full credential once and clears on user action', async () => {
    const user = userEvent.setup()

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) !== '/api/session/reveal') throw new Error('unexpected url')
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          credential: { type: 'session', token: 'token_plain', timestamp: 1700000000000 },
        }),
      } as Response
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    render(<AuthInspectorPage mode="safe" />)

    await user.click(screen.getByText(/展示完整凭证信息（高风险/))
    await user.click(screen.getByRole('button', { name: '从服务器获取一次并展示' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText(/token_plain/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '隐藏并清空' }))
    expect(screen.queryByText(/token_plain/)).toBeNull()
  })
})
