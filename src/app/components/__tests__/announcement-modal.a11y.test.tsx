// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnnouncementModal } from '../AnnouncementModal';

describe('AnnouncementModal a11y baseline', () => {
  it('renders as a dialog and closes on Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <AnnouncementModal
        announcements={[
          {
            id: 'a-1',
            type: 'info',
            title: '公告标题',
            content: 'hello',
            enabled: true,
            dismissible: true,
            publishDate: '2026-01-01T00:00:00.000Z',
            priority: 'low',
          },
        ]}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('公告标题')).toBeTruthy();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
