// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SessionExpiredModal } from '../SessionExpiredModal';

afterEach(() => cleanup());

describe('SessionExpiredModal', () => {
  it('展示登录状态异常提示与操作按钮', () => {
    render(<SessionExpiredModal onReLogin={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('登录状态异常')).toBeTruthy();
    expect(screen.getByRole('button', { name: '去登录' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '我知道了' })).toBeTruthy();
  });

  it('点击“去登录”触发重新登录回调', () => {
    const onReLogin = vi.fn();
    render(<SessionExpiredModal onReLogin={onReLogin} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '去登录' }));
    expect(onReLogin).toHaveBeenCalledTimes(1);
  });

  it('点击“我知道了”触发关闭回调', () => {
    const onDismiss = vi.fn();
    render(<SessionExpiredModal onReLogin={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: '我知道了' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
