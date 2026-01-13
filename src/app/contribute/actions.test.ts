import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAuthSession } from '@/app/lib/auth/session'
import { headers } from 'next/headers'

import { submitTip } from './actions';

vi.mock('@/app/lib/auth/session', () => ({ getAuthSession: vi.fn() }))
vi.mock('next/headers', () => ({ headers: vi.fn() }))

describe('submitTip', () => {
  const webhook = 'https://example.com/webhook';
  const getAuthSessionMock = vi.mocked(getAuthSession)
  const headersMock = vi.mocked(headers)

  beforeEach(() => {
    process.env.FEISHU_WEBHOOK_URL = webhook;
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ code: 0 }),
    }) as unknown as typeof fetch;
    headersMock.mockResolvedValue({
      get(name: string) {
        if (name.toLowerCase() === 'x-forwarded-for') return '1.1.1.1'
        return null
      },
    } as unknown as Headers)
    getAuthSessionMock.mockResolvedValue({
      credential: { type: 'session', token: 'test_token', timestamp: Date.now() },
    } as unknown as Awaited<ReturnType<typeof getAuthSession>>)
  });

  it('returns error when not logged in', async () => {
    getAuthSessionMock.mockResolvedValueOnce({ credential: undefined } as unknown as Awaited<ReturnType<typeof getAuthSession>>)
    const form = new FormData();
    form.set('tip', 'hello world');
    const result = await submitTip(form);
    expect(result.success).toBe(false);
    expect(result.message).toContain('登录');
  });

  it('returns error when tip is empty', async () => {
    const form = new FormData();
    const result = await submitTip(form);
    expect(result.success).toBe(false);
  });

  it('uses anonymous author when missing', async () => {
    const form = new FormData();
    form.set('tip', 'hello world');

    const result = await submitTip(form);
    expect(result.success).toBe(true);

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.content.text).toContain('投稿人：匿名投稿');
  });

  it('sends custom author when provided', async () => {
    const form = new FormData();
    form.set('tip', 'great idea');
    form.set('author', 'Alice ');

    await submitTip(form);

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.content.text).toContain('投稿人：Alice');
  });

  it('silently drops submission when honeypot is filled', async () => {
    const form = new FormData();
    form.set('tip', 'spam');
    form.set('website', 'https://spam.example');

    const result = await submitTip(form);
    expect(result.success).toBe(true);

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rate limits repeated submissions by IP', async () => {
    headersMock.mockResolvedValue({
      get(name: string) {
        if (name.toLowerCase() === 'x-forwarded-for') return '9.9.9.9'
        return null
      },
    } as unknown as Headers)

    const form = new FormData();
    form.set('tip', 'hello');

    const r1 = await submitTip(form);
    const r2 = await submitTip(form);
    const r3 = await submitTip(form);
    const r4 = await submitTip(form);

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r3.success).toBe(true);
    expect(r4.success).toBe(false);

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
