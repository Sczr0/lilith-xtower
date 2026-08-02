// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgreementModal } from '../AgreementModal';

afterEach(() => {
  cleanup();
});

describe('AgreementModal a11y baseline', () => {
  it('renders simple mode as a dialog and can be declined', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<AgreementModal html="" onAgree={() => {}} onClose={onClose} />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('继续前请确认用户协议')).toBeTruthy();

    // 说明：组件有意阻止 Escape 关闭（协议需明确选择同意/不同意），因此通过「不同意」按钮关闭
    await user.click(screen.getByRole('button', { name: '不同意' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('renders full mode as a dialog and can be declined', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<AgreementModal html="<p>hello</p>" onAgree={() => {}} onClose={onClose} />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /用户协议/ })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '不同意' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

