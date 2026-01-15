// @vitest-environment jsdom

import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light' }),
}))

vi.mock('../../../components/ThemeToggle', () => ({
  ThemeToggle: () => <button type="button">ThemeToggle</button>,
}))

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    credential: { type: 'session' },
    logout: vi.fn(),
  }),
}))

import { Sidebar } from '../Sidebar'

describe('Dashboard Sidebar mobile action links', () => {
  it('does not render debug/unified api entry and includes /auth entry', () => {
    render(<Sidebar isMobileOpen={true} />)

    expect(screen.queryByText('调试页面')).toBeNull()
    expect(screen.queryByText('联合API接入')).toBeNull()

    const authLink = screen.getByRole('link', { name: '认证' }) as HTMLAnchorElement
    expect(authLink.getAttribute('href')).toBe('/auth')
  })

  it('does not include unified api entry in collapsed view and keeps auth icon entry', async () => {
    const user = userEvent.setup()
    render(<Sidebar isMobileOpen={true} />)

    await user.click(screen.getAllByTitle('收起侧边栏')[0])

    expect(screen.queryByTitle('联合API接入')).toBeNull()
    expect(screen.getByTitle('认证')).toBeTruthy()
  })
})
