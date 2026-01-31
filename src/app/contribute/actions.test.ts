import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAuthSession } from '@/app/lib/auth/session'
import { headers } from 'next/headers'

import { submitFeedback } from './actions';

vi.mock('@/app/lib/auth/session', () => ({ getAuthSession: vi.fn() }))
vi.mock('next/headers', () => ({ headers: vi.fn() }))

describe('submitFeedback', () => {
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
    form.set('content', 'hello world');
    const result = await submitFeedback(form);
    expect(result.success).toBe(false);
    expect(result.message).toContain('登录');
  });

  it('returns error when content is empty', async () => {
    const form = new FormData();
    const result = await submitFeedback(form);
    expect(result.success).toBe(false);
  });

  it('uses anonymous author when missing', async () => {
    const form = new FormData();
    form.set('content', 'hello world');

    const result = await submitFeedback(form);
    expect(result.success).toBe(true);

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.content.text).toContain('提交人：匿名用户');
  });

  it('sends custom author when provided', async () => {
    const form = new FormData();
    form.set('content', 'great idea');
    form.set('author', 'Alice ');

    await submitFeedback(form);

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.content.text).toContain('提交人：Alice');
  });

  it('silently drops submission when honeypot is filled', async () => {
    const form = new FormData();
    form.set('content', 'spam');
    form.set('website', 'https://spam.example');

    const result = await submitFeedback(form);
    expect(result.success).toBe(true);

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('handles different categories', async () => {
    headersMock.mockResolvedValue({
      get(name: string) {
        if (name.toLowerCase() === 'x-forwarded-for') return '2.2.2.2'
        return null
      },
    } as unknown as Headers)

    const form = new FormData();
    form.set('content', 'bug report');
    form.set('category', 'bug');

    await submitFeedback(form);

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.content.text).toContain('【Bug 反馈】');
  });

  it('rate limits repeated submissions by IP', async () => {
    headersMock.mockResolvedValue({
      get(name: string) {
        if (name.toLowerCase() === 'x-forwarded-for') return '9.9.9.9'
        return null
      },
    } as unknown as Headers)

    const form = new FormData();
    form.set('content', 'hello');

    const r1 = await submitFeedback(form);
    const r2 = await submitFeedback(form);
    const r3 = await submitFeedback(form);
    const r4 = await submitFeedback(form);

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r3.success).toBe(true);
    expect(r4.success).toBe(false);

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
