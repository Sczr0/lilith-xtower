// @vitest-environment jsdom

import React, { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthDetailsModal } from '../AuthDetailsModal';
import type { AuthCredentialSummary } from '../../lib/auth/credentialSummary';

const credential: AuthCredentialSummary = {
  type: 'session',
  timestamp: 1735689600000,
  tokenMasked: 'pgrtk_xxx',
};

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        打开认证详情
      </button>
      <AuthDetailsModal
        credential={credential}
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

afterEach(() => {
  cleanup();
});

describe('AuthDetailsModal a11y', () => {
  it('renders dialog semantics and traps focus with keyboard loop', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: '打开认证详情' });
    await user.click(trigger);

    const dialog = screen.getByRole('dialog', { name: '认证凭证详情' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    const closeButton = screen.getByRole('button', { name: '关闭认证凭证详情弹窗' });
    await waitFor(() => expect(document.activeElement).toBe(closeButton));

    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(closeButton);

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(closeButton);
  });

  it('closes on Escape and returns focus to trigger element', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: '打开认证详情' });
    await user.click(trigger);
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
