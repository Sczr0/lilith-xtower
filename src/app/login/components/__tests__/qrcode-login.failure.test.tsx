// @vitest-environment jsdom

/**
 * 回归用例：/login 扫码后「正在跳转到首页…」却不跳转。
 *
 * 根因：AuthContext.login 旧实现吞掉登录接口异常后正常 resolve，QRCodeLogin 只要
 * await 到结果就把状态置为 success，于是 CAP_FAILED / 429 / 502 等失败都被渲染成
 * 「登录成功 / 正在跳转到首页…」，而 isAuthenticated 仍为 false，页面级跳转条件
 * 永不成立 —— 用户永久卡死。
 *
 * 另一个等价死路：用户在协议确认弹窗点「不同意」会触发 handleCloseAgreement 登出，
 * status 仍是 success，旧渲染同样只剩「正在跳转到首页…」。
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { routerMock } = vi.hoisted(() => ({
  routerMock: { replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => '/login',
}));

// Cap：扫码流程里等价于「后台解题未拿到 token / 拿到 token」都可；这里返回 undefined。
vi.mock('../../../lib/cap/client', () => ({
  getCapToken: vi.fn().mockResolvedValue(undefined),
  initCap: vi.fn(),
}));

// TapTap 扫码链路：跳过真实上游，直接产出 sessionToken。
vi.mock('../../../lib/taptap/qrLogin', () => ({
  requestTapTapDeviceCode: vi.fn().mockResolvedValue({
    deviceCode: 'device-code',
    userCode: 'user-code',
    qrcodeUrl: 'https://example.com/qr',
    verificationUrl: 'https://example.com/verify',
    interval: 1,
    expiresIn: 300,
    deviceId: 'web-test',
    flowId: 'flow-test',
  }),
  completeTapTapQrLogin: vi.fn().mockResolvedValue({
    sessionToken: 'session-token',
    profile: {},
    token: {},
  }),
}));

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,AAAA') },
}));

import { AuthProvider } from '../../../contexts/AuthContext';
import { QRCodeLogin } from '../QRCodeLogin';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const GUEST_PAYLOAD = { isAuthenticated: false, credential: null };

describe('QRCodeLogin 登录失败不得伪装成跳转中', () => {
  beforeEach(() => {
    localStorage.clear();
    routerMock.replace.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('登录接口失败时：展示失败原因与重试按钮，而不是「正在跳转到首页…」', async () => {
    const fetchMock = vi
      .fn()
      // AuthProvider 初始化会话状态
      .mockResolvedValueOnce(jsonResponse(GUEST_PAYLOAD))
      // /api/session/login 被 CAP 拒绝
      .mockResolvedValueOnce(
        jsonResponse(
          { success: false, message: '安全验证未完成，请刷新页面后重试', code: 'CAP_FAILED' },
          403,
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <QRCodeLogin taptapVersion="cn" />
      </AuthProvider>,
    );

    expect(await screen.findByText('登录失败')).toBeTruthy();
    expect(screen.getByText('安全验证未完成，请刷新页面后重试')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重新获取二维码' })).toBeTruthy();
    expect(screen.queryByText('正在跳转到首页...')).toBeNull();
    expect(routerMock.replace).not.toHaveBeenCalledWith('/dashboard');
  });

  it('用户在协议弹窗选择「不同意」后：回到可重试的失败态，而不是停在跳转提示', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(GUEST_PAYLOAD))
      // 登录成功但服务端要求重新同意协议
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          credential: { type: 'api', api_user_id: 'u1', timestamp: 0 },
          consentRequired: true,
        }),
      )
      // handleCloseAgreement 触发的登出请求
      .mockResolvedValueOnce(jsonResponse({ success: true }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <QRCodeLogin taptapVersion="cn" />
      </AuthProvider>,
    );

    expect(await screen.findByText('请在弹窗中阅读并同意用户协议后继续')).toBeTruthy();

    fireEvent.click(await screen.findByRole('button', { name: '不同意' }));

    expect(await screen.findByText('登录未完成')).toBeTruthy();
    expect(screen.queryByText('正在跳转到首页...')).toBeNull();
    expect(screen.getByRole('button', { name: '重新获取二维码' })).toBeTruthy();
  });
});
