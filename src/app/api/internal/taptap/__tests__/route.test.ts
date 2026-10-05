import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST } from '../route';

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function makeRequest(body: unknown) {
  return { json: async () => body } as never;
}

/** seekend 2 端点流程的假上游：POST=建码，GET=状态。 */
function installUpstream(statusBody: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonRes({ qrId: 'qr-1', verificationUrl: 'https://accounts.taptap.cn/device', expiresIn: 300, interval: 1 });
      }
      return jsonRes(statusBody);
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api/internal/taptap 过渡 shim（兼容旧客户端 4 动作）', () => {
  it('device_code → poll(Confirmed) → profile → leancloud 交出 sessionToken', async () => {
    installUpstream({ status: 'Confirmed', sessionToken: 'r:session' });

    const create = await (await POST(makeRequest({ action: 'device_code', version: 'cn' }))).json();
    expect(create.verificationUrl).toBe('https://accounts.taptap.cn/device');
    expect(create.qrcodeUrl).toBe('https://accounts.taptap.cn/device');
    expect(create.flowId).toBeTruthy();

    const poll = await (await POST(makeRequest({ action: 'poll_token', version: 'cn', flowId: create.flowId }))).json();
    expect(poll).toEqual({ status: 'ok', token: {} });

    const profile = await (
      await POST(makeRequest({ action: 'profile', version: 'cn', flowId: create.flowId }))
    ).json();
    expect(profile).toMatchObject({ verified: false });

    const leancloud = await (
      await POST(makeRequest({ action: 'leancloud', version: 'cn', flowId: create.flowId }))
    ).json();
    expect(leancloud).toEqual({ sessionToken: 'r:session' });
  });

  it('未授权时 poll_token 回 pending', async () => {
    installUpstream({ status: 'Pending', retryAfter: 1 });
    const create = await (await POST(makeRequest({ action: 'device_code', version: 'cn' }))).json();
    const poll = await (await POST(makeRequest({ action: 'poll_token', flowId: create.flowId }))).json();
    expect(poll.status).toBe('pending');
  });

  it('二维码过期时回 denied', async () => {
    installUpstream({ status: 'Expired', message: '二维码已过期' });
    const create = await (await POST(makeRequest({ action: 'device_code', version: 'cn' }))).json();
    const poll = await (await POST(makeRequest({ action: 'poll_token', flowId: create.flowId }))).json();
    expect(poll).toEqual({ status: 'denied', msg: '二维码已过期' });
  });

  it('未知 flow 返回 400 与旧客户端能识别的文案', async () => {
    const res = await POST(makeRequest({ action: 'poll_token', flowId: 'nope' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('授权流程无效或已过期');
  });

  it('未知 action 返回 400', async () => {
    const res = await POST(makeRequest({ action: 'bogus' }));
    expect(res.status).toBe(400);
  });
});
