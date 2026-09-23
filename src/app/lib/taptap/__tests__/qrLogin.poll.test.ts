// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pollTapTapToken, requestTapTapDeviceCode } from '../qrLogin';

/**
 * 说明：jsdom 环境下 `USE_PROXY` 为 true，测试走的是生产实际使用的代理路径
 * （即 /api/internal/taptap），而非 Node 直连分支。
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

describe('requestTapTapDeviceCode 错误展示', () => {
  it('从 429 的 JSON 中提取可读文案，而不是把原始 JSON 抛到界面', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: '请求过于频繁，请稍后重试' }, 429));
    vi.stubGlobal('fetch', fetchMock);

    const error = await requestTapTapDeviceCode('cn').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('请求过于频繁，请稍后重试');
    // 不能把原始 JSON 文本暴露给用户
    expect((error as Error).message).not.toContain('{"error"');
  });

  it('错误体为纯文本时回退为文本内容', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestTapTapDeviceCode('cn')).rejects.toThrow('Bad Gateway');
  });
});

describe('pollTapTapToken 轮询容错', () => {
  it('轮询到 ok 时返回令牌', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: 'pending' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'waiting' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'ok', token: { access_token: 'at-ok' } }));
    vi.stubGlobal('fetch', fetchMock);

    const token = await pollTapTapToken('cn', 'dc', 'dev', 1, 5_000, undefined, 'flow-1');

    expect(token.access_token).toBe('at-ok');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('瞬时 5xx 不判死，退避后继续轮询直至成功', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'bad gateway' }, 502))
      .mockResolvedValueOnce(jsonResponse({ status: 'ok', token: { access_token: 'at-retry' } }));
    vi.stubGlobal('fetch', fetchMock);

    const token = await pollTapTapToken('cn', 'dc', 'dev', 1, 5_000, undefined, 'flow-1');

    expect(token.access_token).toBe('at-retry');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('slow_down 视为可继续，退避后继续轮询', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: 'slow_down' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'ok', token: { access_token: 'at-slow' } }));
    vi.stubGlobal('fetch', fetchMock);

    const token = await pollTapTapToken('cn', 'dc', 'dev', 1, 5_000, undefined, 'flow-1');

    expect(token.access_token).toBe('at-slow');
  });

  it('denied（用户拒绝授权）立即终止并抛出上游文案', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: 'denied', msg: '用户取消或拒绝授权' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(pollTapTapToken('cn', 'dc', 'dev', 1, 5_000, undefined, 'flow-1')).rejects.toThrow(
      '用户取消或拒绝授权',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('连续瞬时错误超过阈值后终止并提示重试', async () => {
    // 每次都要新建 Response：body 只能被读取一次，复用同一实例会让后续 res.text() 抛错
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(jsonResponse({ error: '上游持续失败' }, 500)));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      pollTapTapToken('cn', 'dc', 'dev', 1, 60_000, undefined, 'flow-1'),
    ).rejects.toThrow('上游持续失败');
    // 至少发生了若干次重试后才放弃
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });
});
