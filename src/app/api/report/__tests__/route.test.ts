import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Logger } from 'next-axiom';

import { POST, allowReport } from '../route';

vi.mock('next-axiom', () => {
  const log = { info: vi.fn(), flush: vi.fn().mockResolvedValue(undefined) };
  // 注意：实现必须用普通函数（`new Logger()` 场景下箭头函数不是构造器）
  return { Logger: vi.fn(function () { return log; }) };
});

function makeRequest(payload: unknown, extraHeaders: Record<string, string> = {}) {
  return {
    headers: {
      get(name: string) {
        const lower = name.toLowerCase();
        if (lower === 'content-type') return 'application/json';
        if (lower === 'x-forwarded-for') return '1.1.1.1';
        if (lower === 'user-agent') return 'Mozilla/5.0 Chrome';
        return extraHeaders[lower] ?? null;
      },
    },
    json: async () => payload,
  } as never;
}

function lastLogInfo(): ReturnType<typeof vi.fn> {
  const loggerMock = vi.mocked(Logger);
  const instance = loggerMock.mock.results[loggerMock.mock.results.length - 1]?.value as {
    info: ReturnType<typeof vi.fn>;
  };
  return instance.info;
}

describe('POST /api/report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('合法上报写入 Axiom 并返回 204', async () => {
    const res = await POST(
      makeRequest({
        kind: 'error',
        message: 'TypeError: boom',
        stack: 'TypeError: boom\n    at Foo (x.ts)',
        page: '/dashboard',
        version: 'abc1234',
        viewId: '1754120000000-1',
        t: 1754120000000,
        login: { authenticated: true, method: 'platform' },
        events: [
          { t: 1, type: 'fetch', url: '/api/x', method: 'GET', status: 500, durMs: 100 },
          { t: 2, type: 'route', url: '/dashboard' },
        ],
      }),
    );
    expect(res.status).toBe(204);

    expect(lastLogInfo()).toHaveBeenCalledWith('client-error', expect.objectContaining({
      kind: 'error',
      message: 'TypeError: boom',
      page: '/dashboard',
      version: 'abc1234',
      ua: 'Mozilla/5.0 Chrome',
      events: expect.arrayContaining([
        expect.objectContaining({ type: 'fetch', url: '/api/x', status: 500 }),
      ]),
    }));
  });

  it('事件数超过上限时只保留最近 50 条', async () => {
    const events = Array.from({ length: 70 }, (_, i) => ({
      t: i,
      type: 'route' as const,
      url: `/page-${i}`,
    }));
    await POST(makeRequest({ kind: 'error', message: 'x', events }));
    const info = lastLogInfo();
    const payload = info.mock.calls[0][1] as { events: unknown[] };
    expect(payload.events).toHaveLength(50);
    expect((payload.events[0] as { url: string }).url).toBe('/page-20');
  });

  it('超长字段被截断', async () => {
    await POST(
      makeRequest({
        kind: 'error',
        message: 'm'.repeat(5000),
        stack: 's'.repeat(20000),
        events: [{ t: 1, type: 'error', message: 'e'.repeat(5000) }],
      }),
    );
    const payload = lastLogInfo().mock.calls[0][1] as {
      message: string;
      stack: string;
      events: { message: string }[];
    };
    expect(payload.message).toHaveLength(1000);
    expect(payload.stack).toHaveLength(8000);
    expect(payload.events[0].message).toHaveLength(1000);
  });

  it('非法 kind 静默丢弃', async () => {
    const res = await POST(makeRequest({ kind: 'spam', message: 'x' }));
    expect(res.status).toBe(204);
    expect(lastLogInfo()).not.toHaveBeenCalled();
  });

  it('无 message 且无事件时丢弃', async () => {
    const res = await POST(makeRequest({ kind: 'error', page: '/x' }));
    expect(res.status).toBe(204);
    expect(lastLogInfo()).not.toHaveBeenCalled();
  });

  it('非 JSON 内容类型返回 400', async () => {
    const res = await POST({
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/plain' : null) },
      json: async () => ({}),
    } as never);
    expect(res.status).toBe(400);
  });

  it('异常 payload 不抛错（吞错返回 204）', async () => {
    const res = await POST({
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => {
        throw new Error('bad json');
      },
    } as never);
    expect(res.status).toBe(204);
  });
});

describe('allowReport 限流', () => {
  it('窗口内超过 60 次拒绝', () => {
    for (let i = 0; i < 60; i++) {
      expect(allowReport('ip-a')).toBe(true);
    }
    expect(allowReport('ip-a')).toBe(false);
  });

  it('不同 IP 互不影响', () => {
    for (let i = 0; i < 60; i++) allowReport('ip-b');
    expect(allowReport('ip-c')).toBe(true);
  });
});
