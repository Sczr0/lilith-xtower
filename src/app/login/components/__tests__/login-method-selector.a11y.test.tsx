// @vitest-environment jsdom

import React, { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginMethodSelector } from '../LoginMethodSelector'

describe('LoginMethodSelector a11y', () => {
  it('renders a radiogroup and supports arrow key selection', async () => {
    const user = userEvent.setup()

    const methods = [
      { id: 'a', name: 'A', description: 'first', icon: <span aria-hidden>A</span> },
      { id: 'b', name: 'B', description: 'second', icon: <span aria-hidden>B</span> },
    ] as const

    function Harness() {
      const [value, setValue] = useState<(typeof methods)[number]['id']>('a')
      return (
        <div>
          <h2 id="login-methods-title">选择登录方式</h2>
          <LoginMethodSelector
            titleId="login-methods-title"
            methods={methods}
            value={value}
            onValueChange={setValue}
          />
        </div>
      )
    }

    render(<Harness />)

    expect(screen.getByRole('radiogroup')).toBeTruthy()

    const first = screen.getAllByRole('radio')[0]
    expect(first.getAttribute('aria-checked')).toBe('true')

    first.focus()
    await user.keyboard('{ArrowDown}')

    const radiosAfter = screen.getAllByRole('radio')
    expect(radiosAfter[1].getAttribute('aria-checked')).toBe('true')
  })
})

