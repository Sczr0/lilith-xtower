import { describe, expect, it } from 'vitest';

import { resolveAuthGuardAction } from '../authGuard';

/**
 * 回归用例（P0-2）：把「暂时查不到会话状态」和「未登录」区分开。
 */
describe('resolveAuthGuardAction', () => {
  it('加载中：等待，不跳转', () => {
    expect(
      resolveAuthGuardAction({ isLoading: true, isAuthenticated: false, isSessionVerified: false }),
    ).toBe('wait');
  });

  it('已登录：放行', () => {
    expect(
      resolveAuthGuardAction({ isLoading: false, isAuthenticated: true, isSessionVerified: true }),
    ).toBe('allow');
  });

  it('已确认未登录：跳转登录页', () => {
    expect(
      resolveAuthGuardAction({ isLoading: false, isAuthenticated: false, isSessionVerified: true }),
    ).toBe('redirect-login');
  });

  it('会话状态查不到（超时/5xx）：不跳转，避免登录页与仪表盘来回弹', () => {
    expect(
      resolveAuthGuardAction({ isLoading: false, isAuthenticated: false, isSessionVerified: false }),
    ).toBe('wait');
  });
});
