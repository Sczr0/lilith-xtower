// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { AuthStorage } from '../../lib/storage/auth';

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: { current: '/' } }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => pathnameMock.current,
}));

// AgreementModal 经 next/dynamic 懒加载，渲染为可探测标记，用于断言弹窗显隐。
vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const DynamicPlaceholder = () => <div data-testid="dynamic-modal" />;
    DynamicPlaceholder.displayName = 'DynamicPlaceholder';
    return DynamicPlaceholder;
  },
}));

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const GUEST_PAYLOAD = { isAuthenticated: false, credential: null };
const AUTHED_PAYLOAD = {
  isAuthenticated: true,
  credential: { type: 'api', api_user_id: 'u1', timestamp: 0 },
  taptapVersion: 'cn',
  consentRequired: false,
};
const AUTHED_PAYLOAD_WITH_CONSENT = { ...AUTHED_PAYLOAD, consentRequired: true };

function AuthStateProbe() {
  const { isAuthenticated, isLoading, login } = useAuth();
  return (
    <div>
      <span data-testid="auth-state">
        {isLoading ? 'loading' : isAuthenticated ? 'authed' : 'guest'}
      </span>
      <button onClick={() => login({ type: 'api', api_user_id: 'u1', timestamp: 0 })}>login</button>
    </div>
  );
}

describe('AuthContext 登录缓存与异常弹窗', () => {
  beforeEach(() => {
    localStorage.clear();
    pathnameMock.current = '/';
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('缓存已登录但会话无效时：清除缓存并弹出登录状态异常', async () => {
    AuthStorage.setCachedLogin(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(GUEST_PAYLOAD)));

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('登录状态异常')).toBeTruthy();
    expect(AuthStorage.getCachedLogin()).toBe(false);
    expect(screen.getByTestId('auth-state').textContent).toBe('guest');
  });

  it('无缓存且会话无效时：不弹窗', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(GUEST_PAYLOAD)));

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('guest')).toBeTruthy();
    expect(screen.queryByText('登录状态异常')).toBeNull();
  });

  it('缓存已登录且会话有效时：不弹窗', async () => {
    AuthStorage.setCachedLogin(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(AUTHED_PAYLOAD)));

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('authed')).toBeTruthy();
    expect(screen.queryByText('登录状态异常')).toBeNull();
  });

  it('登录成功后写入登录缓存', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(GUEST_PAYLOAD))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          credential: { type: 'api', api_user_id: 'u1', timestamp: 0 },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('guest')).toBeTruthy();
    expect(AuthStorage.getCachedLogin()).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'login' }));

    expect(await screen.findByText('authed')).toBeTruthy();
    expect(AuthStorage.getCachedLogin()).toBe(true);
  });
});

describe('AuthContext 协议确认弹窗', () => {
  beforeEach(() => {
    localStorage.clear();
    pathnameMock.current = '/';
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('协议版本落后时：非阅读页弹出协议确认', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(AUTHED_PAYLOAD_WITH_CONSENT)));

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('authed')).toBeTruthy();
    expect(screen.getByTestId('dynamic-modal')).toBeTruthy();
  });

  it.each(['/agreement', '/privacy'])('协议版本落后时：%s 阅读页不弹协议确认', async (readPath) => {
    pathnameMock.current = readPath;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(AUTHED_PAYLOAD_WITH_CONSENT)));

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('authed')).toBeTruthy();
    expect(screen.queryByTestId('dynamic-modal')).toBeNull();
  });

  it('在阅读页读完协议后：离开页面时恢复协议确认拦截', async () => {
    pathnameMock.current = '/agreement';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(AUTHED_PAYLOAD_WITH_CONSENT)));

    const { rerender } = render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('authed')).toBeTruthy();
    expect(screen.queryByTestId('dynamic-modal')).toBeNull();

    // 模拟用户从阅读页导航到其他页面
    pathnameMock.current = '/';
    rerender(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('dynamic-modal')).toBeTruthy();
  });
});
