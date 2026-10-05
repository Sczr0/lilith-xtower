// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pollTapTapSessionToken, requestTapTapDeviceCode } from '../qrLogin';

/**
 * 新契约：POST /api/auth/qrcode 拉码，GET /api/auth/qrcode/{qrId}/status 轮询。
 * jsdom 环境下走同源代理路径（与生产一致）。
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('requestTapTapDeviceCode', () => {
  it('映射创建响应（qrcodeUrl = verificationUrl）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ qrId: 'q1', verificationUrl: 'https://x/device', expiresIn: 300, interval: 1 }),
      ),
    );
    await expect(requestTapTapDeviceCode('cn')).resolves.toEqual({
      qrId: 'q1',
      verificationUrl: 'https://x/device',
      qrcodeUrl: 'https://x/device',
      expiresIn: 300,
      interval: 1,
    });
  });

  it('从 ProblemDetails 里提取可读文案', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            type: 'about:blank',
            title: 'Validation Failed',
            status: 422,
            code: 'VALIDATION_FAILED',
            detail: 'taptapVersion 必须为 cn 或 global',
          },
          422,
        ),
      ),
    );
    await expect(requestTapTapDeviceCode('cn')).rejects.toThrow('taptapVersion 必须为 cn 或 global');
  });

  it('错误体为纯文本时回退为文本内容', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 })));
    await expect(requestTapTapDeviceCode('cn')).rejects.toThrow('Bad Gateway');
  });
});

describe('pollTapTapSessionToken', () => {
  it('Confirmed 时返回 sessionToken', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: 'Pending', retryAfter: 1 }))
      .mockResolvedValueOnce(jsonResponse({ status: 'Scanned' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'Confirmed', sessionToken: 'r:sess' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(pollTapTapSessionToken('q1', 1, 5_000)).resolves.toBe('r:sess');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('非瞬时错误（UNAUTHORIZED）立即终止并抛上游文案', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: 'Error', errorCode: 'UNAUTHORIZED', message: '认证失败' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(pollTapTapSessionToken('q1', 1, 5_000)).rejects.toThrow('认证失败');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Expired 立即终止', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ status: 'Expired', message: '二维码已过期' })),
    );
    await expect(pollTapTapSessionToken('q1', 1, 5_000)).rejects.toThrow('二维码已过期');
  });

  it('瞬时上游错误退避重试，超过阈值后终止', async () => {
    // 每次新建 Response（body 只能读一次）
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(jsonResponse({ status: 'Error', errorCode: 'UPSTREAM_ERROR', message: '上游网络错误' })),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(pollTapTapSessionToken('q1', 1, 60_000)).rejects.toThrow('上游网络错误');
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });
});
