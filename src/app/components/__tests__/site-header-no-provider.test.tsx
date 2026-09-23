// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ThemeToggle 依赖 next-themes；本测试只关心 Provider 缺失时的降级，不校验主题。
vi.mock('next-themes', () => ({
  useTheme: () => ({ setTheme: vi.fn(), theme: 'light', resolvedTheme: 'light' }),
}));

import { SiteHeader } from '../SiteHeader';

/**
 * 回归测试：根级兜底页（error.tsx / not-found.tsx）会在 AuthProvider /
 * InstallPromptProvider 未建立的错误恢复路径中渲染 SiteHeader。
 * SiteHeader 必须按“未登录 + 不可安装”降级渲染，而不是抛出二次错误
 * （useAuth必须在AuthProvider内部使用）掩盖真实错误。
 */
describe('SiteHeader 在缺少 Provider 时', () => {
  afterEach(cleanup);

  it('降级为未登录渲染且不抛错', () => {
    expect(() => render(<SiteHeader />)).not.toThrow();
    expect(screen.getAllByRole('link', { name: '登录' }).length).toBeGreaterThan(0);
  });
});
