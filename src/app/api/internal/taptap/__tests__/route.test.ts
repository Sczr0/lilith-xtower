import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const upstreamFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api/upstreamFetch', () => ({
  upstreamFetch: (...args: unknown[]) => upstreamFetchMock(...args),
}));

import { POST } from '../route';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeRequest(body: unknown) {
  return {
    headers: new Headers(),
    json: async () => body,
  } as never;
}

function pollRequest(dev: { flowId: string; deviceCode: string; deviceId: string }) {
  return makeRequest({
    action: 'poll_token',
    version: 'cn',
    flowId: dev.flowId,
    deviceCode: dev.deviceCode,
    deviceId: dev.deviceId,
  });
}

const DEVICE_CODE_PAYLOAD = {
  data: {
    device_code: 'dc-1',
    user_code: 'uc-1',
    qrcode_url: 'https://example.com/qr',
    verification_url: 'https://example.com/verify',
    interval: 1,
    expires_in: 300,
  },
};

describe('api/internal/taptap：服务端代为轮询', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    upstreamFetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('device_code 下发 flowId，此时尚不启动上游轮询', async () => {
    upstreamFetchMock.mockResolvedValueOnce(jsonResponse(DEVICE_CODE_PAYLOAD));

    const res = await POST(makeRequest({ action: 'device_code', version: 'cn' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.flowId).toBeTruthy();
    expect(body.deviceCode).toBe('dc-1');
    expect(body.deviceId).toBeTruthy();
    // 只有 device_code 一次上游调用，未额外发起轮询
    expect(upstreamFetchMock).toHaveBeenCalledTimes(1);
  });

  it('poll_token 由服务端后台轮询上游，客户端只读状态，拿到 token 后回 ok', async () => {
    upstreamFetchMock
      .mockResolvedValueOnce(jsonResponse(DEVICE_CODE_PAYLOAD)) // device_code
      .mockResolvedValueOnce(jsonResponse({ data: { error: 'authorization_pending' } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { access_token: 'at-1' } }));

    const dev = await (await POST(makeRequest({ action: 'device_code', version: 'cn' }))).json();

    // 第一次 poll_token：启动后台循环并立即返回 pending（不打上游）
    const first = await (await POST(pollRequest(dev))).json();
    expect(first.status).toBe('pending');
    expect(upstreamFetchMock).toHaveBeenCalledTimes(1);

    // 推进时间：后台循环完成 pending → ok
    await vi.advanceTimersByTimeAsync(2500);

    const second = await (await POST(pollRequest(dev))).json();
    expect(second.status).toBe('ok');
    expect(second.token.access_token).toBe('at-1');
    // 上游调用：device_code 1 次 + 后台轮询 2 次
    expect(upstreamFetchMock).toHaveBeenCalledTimes(3);

    // 终态后再查不会新增上游调用
    const third = await (await POST(pollRequest(dev))).json();
    expect(third.status).toBe('ok');
    expect(upstreamFetchMock).toHaveBeenCalledTimes(3);
  });

  it('上游 access_denied 时，客户端读到 denied 终态', async () => {
    upstreamFetchMock
      .mockResolvedValueOnce(jsonResponse(DEVICE_CODE_PAYLOAD))
      .mockResolvedValueOnce(jsonResponse({ data: { error: 'access_denied' } }));

    const dev = await (await POST(makeRequest({ action: 'device_code', version: 'cn' }))).json();
    await POST(pollRequest(dev));
    await vi.advanceTimersByTimeAsync(1000);

    const body = await (await POST(pollRequest(dev))).json();
    expect(body.status).toBe('denied');
    expect(body.msg).toBe('用户取消或拒绝授权');
  });
});
