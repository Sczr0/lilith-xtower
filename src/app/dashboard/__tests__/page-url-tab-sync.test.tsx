// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

// 可变的 searchParams：模拟 router.push 之后的 URL 查询参数变化
const { searchParamsRef } = vi.hoisted(() => ({
  searchParamsRef: { current: new URLSearchParams('tab=rks-list') },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => searchParamsRef.current,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, error: null }),
}));

vi.mock('../hooks/useDashboardPrefetch', () => ({
  useDashboardPrefetch: () => {},
}));

vi.mock('../hooks/useDashboardContent', () => ({
  useDashboardContent: () => ({
    announcements: [],
    showAnnouncements: false,
    showAllAnnouncements: false,
    openAnnouncements: vi.fn(),
    closeAnnouncements: vi.fn(),
    songUpdates: [],
    songUpdatesStatus: 'idle',
    songUpdatesError: null,
    reloadSongUpdates: vi.fn().mockResolvedValue(undefined),
  }),
}));

// 断言页面把解析出的 activeTab 正确传给内容区（回归：查询按钮软导航后 tab 不切换）
vi.mock('../components/DashboardTabContent', () => ({
  DashboardTabContent: ({ activeTab }: { activeTab: string }) => (
    <div data-testid="tab-content" data-tab={activeTab} />
  ),
}));

vi.mock('../components/DashboardShell', () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../components/PageShell', () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import Dashboard from '../page';

const currentTab = () => (screen.getByTestId('tab-content') as HTMLElement).dataset.tab;

describe('Dashboard tab 与 URL 参数同步', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('tab=rks-list');
  });

  afterEach(() => {
    cleanup();
  });

  it('初始渲染时读取 URL 中的 tab 参数', () => {
    render(<Dashboard />);
    expect(currentTab()).toBe('rks-list');
  });

  it('URL tab 参数变化时（同路由软导航，非 popstate）同步切换 tab', () => {
    const { rerender } = render(<Dashboard />);
    expect(currentTab()).toBe('rks-list');

    // 模拟 RKS 列表“查询”按钮的 router.push('/dashboard?tab=single-query&song=…')
    searchParamsRef.current = new URLSearchParams('tab=single-query&song=Spasmodic');
    rerender(<Dashboard />);

    expect(currentTab()).toBe('single-query');
  });

  it('URL 中无 tab 参数时保持当前 tab 不变', () => {
    const { rerender } = render(<Dashboard />);
    searchParamsRef.current = new URLSearchParams('song=Spasmodic');
    rerender(<Dashboard />);
    expect(currentTab()).toBe('rks-list');
  });
});