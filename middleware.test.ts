import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { decideHtmlCacheControl, shouldApplyHtmlCache } from './middleware';

function makeRequest(pathname: string, init: { accept?: string; method?: string } = {}): NextRequest {
  const headers = new Headers();
  if (init.accept) headers.set('accept', init.accept);
  return new NextRequest(`https://example.com${pathname}`, {
    method: init.method ?? 'GET',
    headers,
  });
}

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

describe('middleware shouldApplyHtmlCache', () => {
  it('applies to whitelisted pages even without Accept: text/html (crawlers send */*)', () => {
    // 回归：bot 的 */* 请求若被跳过，Next 会漏出 s-maxage=31536000，且边缘缓存键不区分 Accept
    expect(shouldApplyHtmlCache(makeRequest('/', { accept: '*/*' }))).toBe(true);
    expect(shouldApplyHtmlCache(makeRequest('/login', { accept: '*/*' }))).toBe(true);
    expect(shouldApplyHtmlCache(makeRequest('/privacy', { accept: '*/*' }))).toBe(true);
  });

  it('applies to document navigations on any path', () => {
    expect(shouldApplyHtmlCache(makeRequest('/dashboard', { accept: 'text/html,*/*;q=0.8' }))).toBe(true);
  });

  it('skips non-whitelisted paths for non-document requests', () => {
    expect(shouldApplyHtmlCache(makeRequest('/dashboard', { accept: '*/*' }))).toBe(false);
  });

  it('skips non-GET/HEAD methods and dotted paths', () => {
    expect(shouldApplyHtmlCache(makeRequest('/', { accept: 'text/html', method: 'POST' }))).toBe(false);
    expect(shouldApplyHtmlCache(makeRequest('/favicon.ico', { accept: 'text/html' }))).toBe(false);
  });

  it('does not treat prototype keys as public paths', () => {
    expect(shouldApplyHtmlCache(makeRequest('/constructor', { accept: '*/*' }))).toBe(false);
    expect(decideHtmlCacheControl({ pathname: '/constructor', hasSession: false })).toBe('private, no-store, max-age=0');
  });
});

