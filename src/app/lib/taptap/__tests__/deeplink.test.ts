import { describe, expect, it } from 'vitest';

import { buildTapTapLoginAuthDeepLink, normalizeTapTapConfirmUrl } from '../deeplink';

describe('lib/taptap/deeplink', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeTapTapConfirmUrl('')).toBe('');
    expect(buildTapTapLoginAuthDeepLink('')).toBe('');
  });

  it('adds opener=web when missing', () => {
    const input = 'https://accounts.taptap.cn/device?qrcode=1&user_code=ABCDEF';
    const normalized = normalizeTapTapConfirmUrl(input);

    const url = new URL(normalized);
    expect(url.origin).toBe('https://accounts.taptap.cn');
    expect(url.pathname).toBe('/device');
    expect(url.searchParams.get('qrcode')).toBe('1');
    expect(url.searchParams.get('user_code')).toBe('ABCDEF');
    expect(url.searchParams.get('opener')).toBe('web');
  });

  it('builds taptap:// login-auth deep link wrapping the https confirm url', () => {
    const input = 'https://accounts.taptap.cn/device?qrcode=1&user_code=ABCDEF';
    const deepLink = buildTapTapLoginAuthDeepLink(input);

    expect(deepLink.startsWith('taptap://taptap.com/login-auth?url=')).toBe(true);

    const encoded = deepLink.split('url=')[1] ?? '';
    const decoded = decodeURIComponent(encoded);

    const url = new URL(decoded);
    expect(url.origin).toBe('https://accounts.taptap.cn');
    expect(url.pathname).toBe('/device');
    expect(url.searchParams.get('qrcode')).toBe('1');
    expect(url.searchParams.get('user_code')).toBe('ABCDEF');
    expect(url.searchParams.get('opener')).toBe('web');
  });

  it('returns input as-is when already a taptap scheme url', () => {
    const input = 'taptap://taptap.com/login-auth?url=https%3A%2F%2Faccounts.taptap.cn%2Fdevice%3Fqrcode%3D1';
    expect(buildTapTapLoginAuthDeepLink(input)).toBe(input);
  });
});

