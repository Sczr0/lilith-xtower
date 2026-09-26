import { describe, expect, it } from 'vitest';

import { decideHtmlCacheControl } from './middleware';

describe('middleware decideHtmlCacheControl', () => {
  it('forces private/no-store when session exists', () => {
    expect(decideHtmlCacheControl({ pathname: '/', hasSession: true })).toBe('private, no-store, max-age=0');
    expect(decideHtmlCacheControl({ pathname: '/about', hasSession: true })).toBe('private, no-store, max-age=0');
    expect(decideHtmlCacheControl({ pathname: '/anything', hasSession: true })).toBe('private, no-store, max-age=0');
  });

  it('allows public cache for whitelisted routes when no session', () => {
    expect(decideHtmlCacheControl({ pathname: '/', hasSession: false })).toContain('public');
    expect(decideHtmlCacheControl({ pathname: '/qa', hasSession: false })).toContain('public');
    expect(decideHtmlCacheControl({ pathname: '/login', hasSession: false })).toContain('public');
    expect(decideHtmlCacheControl({ pathname: '/open-platform', hasSession: false })).toContain('public');
    expect(decideHtmlCacheControl({ pathname: '/open-platform/agreement', hasSession: false })).toContain('public');
    // 静态壳页面：个人化内容全部在客户端（/banned 的详情来自 sessionStorage）
    expect(decideHtmlCacheControl({ pathname: '/verify', hasSession: false })).toContain('public');
    expect(decideHtmlCacheControl({ pathname: '/banned', hasSession: false })).toContain('public');
  });

  it('still forces private/no-store for these shell pages when session exists', () => {
    expect(decideHtmlCacheControl({ pathname: '/verify', hasSession: true })).toBe('private, no-store, max-age=0');
    expect(decideHtmlCacheControl({ pathname: '/banned', hasSession: true })).toBe('private, no-store, max-age=0');
  });

  it('defaults to private/no-store for non-whitelisted routes when no session', () => {
    expect(decideHtmlCacheControl({ pathname: '/dashboard', hasSession: false })).toBe('private, no-store, max-age=0');
    expect(decideHtmlCacheControl({ pathname: '/unified-api-dashboard', hasSession: false })).toBe(
      'private, no-store, max-age=0',
    );
  });
});

