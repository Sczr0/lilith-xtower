import { describe, expect, it } from 'vitest';

import { filterOutSiteOwnedCookies, sanitizeUpstreamSetCookie } from '../proxyCookies';

const SITE_OWNED = new Set(['phigros_auth_session', 'phigros_debug_auth']);

describe('filterOutSiteOwnedCookies', () => {
  it('strips the site session cookie while keeping upstream cookies', () => {
    const header = 'upstream_sid=abc123; phigros_auth_session=sealed-xyz; theme=dark';
    expect(filterOutSiteOwnedCookies(header, SITE_OWNED)).toBe('upstream_sid=abc123; theme=dark');
  });

  it('returns an empty string when only site-owned cookies are present', () => {
    expect(filterOutSiteOwnedCookies('phigros_auth_session=sealed-xyz', SITE_OWNED)).toBe('');
  });

  it('handles whitespace and empty segments', () => {
    const header = '  phigros_debug_auth=1 ;   ; upstream_sid=abc  ';
    expect(filterOutSiteOwnedCookies(header, SITE_OWNED)).toBe('upstream_sid=abc');
  });

  it('keeps cookies whose names merely share a prefix', () => {
    const header = 'phigros_auth_session_extra=keep; phigros_auth_session=drop';
    expect(filterOutSiteOwnedCookies(header, SITE_OWNED)).toBe('phigros_auth_session_extra=keep');
  });

  it('keeps valueless cookie entries untouched unless their name matches', () => {
    const header = 'flag; phigros_auth_session=drop; other=1';
    expect(filterOutSiteOwnedCookies(header, SITE_OWNED)).toBe('flag; other=1');
  });
});

describe('sanitizeUpstreamSetCookie', () => {
  it('drops cookies whose name collides with a site-owned cookie', () => {
    expect(
      sanitizeUpstreamSetCookie('phigros_auth_session=forged; Path=/; HttpOnly', SITE_OWNED),
    ).toBeNull();
  });

  it('strips the Domain attribute to keep the cookie host-only', () => {
    const result = sanitizeUpstreamSetCookie(
      'upstream_sid=abc; Domain=xtower.site; Path=/; HttpOnly; Secure',
      SITE_OWNED,
    );
    expect(result).toBe('upstream_sid=abc; Path=/; HttpOnly; Secure');
  });

  it('keeps non-Domain attributes untouched (case-insensitive match)', () => {
    const result = sanitizeUpstreamSetCookie(
      'upstream_sid=abc; DOMAIN=xtower.site; path=/; Max-Age=3600; SameSite=Lax',
      SITE_OWNED,
    );
    expect(result).toBe('upstream_sid=abc; path=/; Max-Age=3600; SameSite=Lax');
  });

  it('passes through cookies without a Domain attribute unchanged', () => {
    const value = 'upstream_sid=abc; Path=/; HttpOnly';
    expect(sanitizeUpstreamSetCookie(value, SITE_OWNED)).toBe(value);
  });

  it('does not strip attributes that merely contain "domain" as a substring', () => {
    const value = 'upstream_sid=abc; X-Domain-Hint=keep';
    expect(sanitizeUpstreamSetCookie(value, SITE_OWNED)).toBe(value);
  });

  it('preserves Expires values containing semicolon-confusable characters', () => {
    const value = 'upstream_sid=abc; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/';
    expect(sanitizeUpstreamSetCookie(value, SITE_OWNED)).toBe(value);
  });

  it('rejects malformed entries without a name=value pair', () => {
    expect(sanitizeUpstreamSetCookie('nonsense', SITE_OWNED)).toBeNull();
    expect(sanitizeUpstreamSetCookie('=value; Path=/', SITE_OWNED)).toBeNull();
  });
});
