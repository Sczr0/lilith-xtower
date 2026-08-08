// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ isAuthenticated: true, isLoading: false })),
}));

vi.mock('@/app/contribute/actions', () => ({
  submitFeedback: vi.fn(),
}));

import { submitFeedback } from '@/app/contribute/actions';
import { useAuth } from '@/app/contexts/AuthContext';
import { FeedbackDialog } from '../FeedbackDialog';

const submitFeedbackMock = vi.mocked(submitFeedback);
const useAuthMock = vi.mocked(useAuth);

/** 构造完整的 AuthContextType 假值（FeedbackDialog 只读其中认证相关字段） */
function authValue(overrides: { isAuthenticated?: boolean; isLoading?: boolean } = {}) {
  return {
    isAuthenticated: true,
    isLoading: false,
    credential: null,
    error: null,
    consentRequired: false,
    login: vi.fn(),
    logout: vi.fn(),
    validateCurrentCredential: vi.fn(),
    ...overrides,
  } as never;
}

describe('FeedbackDialog', () => {
  beforeEach(() => {
    submitFeedbackMock.mockResolvedValue({ success: true, message: '提交成功！感谢你的反馈~' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useAuthMock.mockReturnValue(authValue());
  });

  it('点击触发按钮后打开弹窗', async () => {
    render(<FeedbackDialog />);
    fireEvent.click(screen.getByRole('button', { name: '遇到问题？' }));
    expect(await screen.findByRole('dialog', { name: '遇到问题？' })).toBeTruthy();
  });

  it('提交时自动携带 report 分类与诊断信息', async () => {
    render(<FeedbackDialog />);
    fireEvent.click(screen.getByRole('button', { name: '遇到问题？' }));
    await screen.findByRole('dialog', { name: '遇到问题？' });

    fireEvent.change(screen.getByLabelText('问题描述（限 500 字）'), {
      target: { value: '图片生成一直转圈' },
    });
    fireEvent.submit(document.querySelector('form#feedback-form')!);

    await waitFor(() => expect(submitFeedbackMock).toHaveBeenCalledTimes(1));
    const formData = submitFeedbackMock.mock.calls[0][0];
    expect(formData.get('category')).toBe('report');
    expect(formData.get('content')).toBe('图片生成一直转圈');
    const diagnostics = String(formData.get('diagnostics'));
    expect(diagnostics).toContain('【诊断信息】');
    expect(diagnostics).toContain('页面:');
  });

  it('提交成功后显示成功提示', async () => {
    render(<FeedbackDialog />);
    fireEvent.click(screen.getByRole('button', { name: '遇到问题？' }));
    await screen.findByRole('dialog', { name: '遇到问题？' });

    fireEvent.change(screen.getByLabelText('问题描述（限 500 字）'), {
      target: { value: '排行榜加载慢' },
    });
    fireEvent.submit(document.querySelector('form#feedback-form')!);

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('提交成功'),
    );
  });

  it('复制诊断信息按钮把诊断块写入剪贴板', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(<FeedbackDialog />);
    fireEvent.click(screen.getByRole('button', { name: '遇到问题？' }));
    await screen.findByRole('dialog', { name: '遇到问题？' });

    fireEvent.click(screen.getByRole('button', { name: /自动采集/ }));
    fireEvent.click(screen.getByRole('button', { name: '复制诊断信息' }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('【诊断信息】')),
    );
  });

  it('未登录时禁用提交并提示登录', async () => {
    useAuthMock.mockReturnValue(authValue({ isAuthenticated: false }));

    render(<FeedbackDialog />);
    fireEvent.click(screen.getByRole('button', { name: '遇到问题？' }));
    await screen.findByRole('dialog', { name: '遇到问题？' });

    const submitButton = screen.getByRole('button', { name: '提交反馈' }) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
    expect(screen.getByText(/去登录/)).toBeTruthy();
  });

  it('错误页入口：传入 initialError 时写入诊断轨迹', async () => {
    render(
      <FeedbackDialog
        label="反馈这个问题"
        initialError={{ message: 'boom', stack: 'TypeError: boom\n    at Foo (x.ts)' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '反馈这个问题' }));
    await screen.findByRole('dialog', { name: '遇到问题？' });

    fireEvent.click(screen.getByRole('button', { name: /自动采集/ }));
    expect(screen.getByText(/boom/)).toBeTruthy();
  });
});
