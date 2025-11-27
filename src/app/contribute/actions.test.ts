import { beforeEach, describe, expect, it, vi } from 'vitest';
import { submitTip } from './actions';

describe('submitTip', () => {
  const webhook = 'https://example.com/webhook';

  beforeEach(() => {
    process.env.FEISHU_WEBHOOK_URL = webhook;
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ code: 0 }),
    }) as unknown as typeof fetch;
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
});
