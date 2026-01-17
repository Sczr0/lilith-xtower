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
  });

  it('defaults to private/no-store for non-whitelisted routes when no session', () => {
    expect(decideHtmlCacheControl({ pathname: '/dashboard', hasSession: false })).toBe('private, no-store, max-age=0');
    expect(decideHtmlCacheControl({ pathname: '/unified-api-dashboard', hasSession: false })).toBe(
      'private, no-store, max-age=0',
    );
  });
});

