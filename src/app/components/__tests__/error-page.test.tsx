// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/lib/diagnostics/collector', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/diagnostics/collector')>();
  return { ...actual, pushEvent: vi.fn(), reportErrorToServer: vi.fn() };
});

vi.mock('@/app/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ isAuthenticated: true, isLoading: false })),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ setTheme: vi.fn(), theme: 'light', resolvedTheme: 'light' }),
}));

vi.mock('@/app/contribute/actions', () => ({
  submitFeedback: vi.fn(),
}));

import type { ReactElement } from 'react';

import { pushEvent, reportErrorToServer } from '@/app/lib/diagnostics/collector';
import { InstallPromptProvider } from '@/app/contexts/InstallPromptContext';
import ErrorPage from '../../error';

// ErrorPage → SiteHeader → InstallButton 依赖 InstallPromptContext；
// 与 install-button.test.tsx 一致，用真实 Provider 包裹而非 mock。
function renderErrorPage(ui: ReactElement) {
  return render(<InstallPromptProvider>{ui}</InstallPromptProvider>);
}

const reportErrorToServerMock = vi.mocked(reportErrorToServer);
const pushEventMock = vi.mocked(pushEvent);

describe('ErrorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('渲染 500 提示与重试/反馈按钮', () => {
    renderErrorPage(<ErrorPage error={new Error('boom')} reset={vi.fn()} />);
    expect(screen.getByText('500')).toBeTruthy();
    expect(screen.getByText('出错了')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '反馈这个问题' })).toBeTruthy();
  });

  it('挂载时自动上报错误并写入轨迹（仅一次）', async () => {
    const error = new Error('boom');
    const { rerender } = renderErrorPage(<ErrorPage error={error} reset={vi.fn()} />);
    rerender(
      <InstallPromptProvider>
        <ErrorPage error={error} reset={vi.fn()} />
      </InstallPromptProvider>,
    );

    await waitFor(() =>
      expect(reportErrorToServerMock).toHaveBeenCalledTimes(1),
    );
    expect(reportErrorToServerMock).toHaveBeenCalledWith('boom', error.stack, '/');
    expect(pushEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', message: 'boom' }),
    );
  });

  it('点击重试调用 reset', () => {
    const reset = vi.fn();
    renderErrorPage(<ErrorPage error={new Error('boom')} reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('点击反馈按钮打开反馈弹窗', async () => {
    renderErrorPage(<ErrorPage error={new Error('boom')} reset={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '反馈这个问题' }));
    expect(await screen.findByRole('dialog', { name: '遇到问题？' })).toBeTruthy();
  });
});
