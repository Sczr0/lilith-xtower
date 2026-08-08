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
    form.set('contact', 'qq:123456');

    await submitFeedback(form);

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.content.text).toContain('【Bug 反馈】');
    expect(body.content.text).toContain('联系方式：qq:123456');
  });

  it('requires contact for non-tip categories', async () => {
    headersMock.mockResolvedValue({
      get(name: string) {
        if (name.toLowerCase() === 'x-forwarded-for') return '3.3.3.3'
        return null
      },
    } as unknown as Headers)

    const form = new FormData();
    form.set('content', 'feature request');
    form.set('category', 'feature');

    const result = await submitFeedback(form);
    expect(result.success).toBe(false);
    expect(result.message).toContain('联系方式');

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

  it('appends diagnostics to feishu message', async () => {
    headersMock.mockResolvedValue({
      get(name: string) {
        if (name.toLowerCase() === 'x-forwarded-for') return '5.5.5.5'
        return null
      },
    } as unknown as Headers)

    const form = new FormData();
    form.set('content', '图片生成一直转圈');
    form.set('category', 'bug');
    form.set('contact', 'qq:123');
    form.set('diagnostics', '【诊断信息】Phigros Query vabc1234\n页面: /dashboard');

    const result = await submitFeedback(form);
    expect(result.success).toBe(true);

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.content.text).toContain('诊断信息：');
    expect(body.content.text).toContain('【诊断信息】Phigros Query vabc1234');
  });

  it('truncates diagnostics to 2000 chars and omits empty diagnostics', async () => {
    headersMock.mockResolvedValue({
      get(name: string) {
        if (name.toLowerCase() === 'x-forwarded-for') return '6.6.6.6'
        return null
      },
    } as unknown as Headers)

    const longForm = new FormData();
    longForm.set('content', '内容');
    longForm.set('category', 'bug');
    longForm.set('contact', 'qq:123');
    longForm.set('diagnostics', 'd'.repeat(5000));
    await submitFeedback(longForm);

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const longBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(longBody.content.text).toContain('d'.repeat(2000));
    expect(longBody.content.text).not.toContain('d'.repeat(2001));

    const plainForm = new FormData();
    plainForm.set('content', '内容');
    plainForm.set('category', 'bug');
    plainForm.set('contact', 'qq:123');
    await submitFeedback(plainForm);

    const plainBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(plainBody.content.text).not.toContain('诊断信息：');
  });
});
