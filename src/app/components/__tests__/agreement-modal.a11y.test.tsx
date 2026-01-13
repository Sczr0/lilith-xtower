// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgreementModal } from '../AgreementModal';

describe('AgreementModal a11y baseline', () => {
  it('renders simple mode as a dialog and closes on Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<AgreementModal html="" onAgree={() => {}} onClose={onClose} />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('继续前请确认用户协议')).toBeTruthy();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('renders full mode as a dialog and can be closed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<AgreementModal html="<p>hello</p>" onAgree={() => {}} onClose={onClose} />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/用户协议/)).toBeTruthy();

    await user.click(screen.getByLabelText('关闭用户协议弹窗'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

