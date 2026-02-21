import { describe, expect, it } from 'vitest';

import {
  GLOBAL_BAN_CODE,
  detectGlobalBanFromResponse,
  parseGlobalBanPayload,
  shouldInspectBanForRequest,
} from '../banGuard';

describe('parseGlobalBanPayload', () => {
  it('returns banned result when code is FORBIDDEN', () => {
    const result = parseGlobalBanPayload({ code: GLOBAL_BAN_CODE, detail: '用户已被全局封禁' });
    expect(result).toEqual({ isGlobalBan: true, detail: '用户已被全局封禁' });
  });

  it('returns non-banned result when code does not match', () => {
    const result = parseGlobalBanPayload({ code: 'UNAUTHORIZED', detail: '未登录' });
    expect(result).toEqual({ isGlobalBan: false, detail: null });
  });
});

describe('detectGlobalBanFromResponse', () => {
  it('detects global ban from 403 problem response', async () => {
    const response = new Response(JSON.stringify({ code: GLOBAL_BAN_CODE, detail: '用户已被全局封禁' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(detectGlobalBanFromResponse(response)).resolves.toEqual({
      isGlobalBan: true,
      detail: '用户已被全局封禁',
    });
  });

  it('ignores non-json 403 response', async () => {
    const response = new Response('forbidden', { status: 403, headers: { 'Content-Type': 'text/plain' } });

    await expect(detectGlobalBanFromResponse(response)).resolves.toEqual({
      isGlobalBan: false,
      detail: null,
    });
  });
});

describe('shouldInspectBanForRequest', () => {
  it('only inspects same-origin /api requests', () => {
    expect(shouldInspectBanForRequest('/api/save', 'https://lilith.xtower.site')).toBe(true);
    expect(shouldInspectBanForRequest('/health', 'https://lilith.xtower.site')).toBe(false);
    expect(shouldInspectBanForRequest('https://example.com/api/save', 'https://lilith.xtower.site')).toBe(false);
  });
});
