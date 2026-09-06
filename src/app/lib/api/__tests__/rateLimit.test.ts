import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

import { isPubliclyRoutableIp, resolveClientIp, slidingWindowAllow } from '../rateLimit';

function createRequest(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

describe('resolveClientIp', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns unknown when no trusted headers are present', () => {
    expect(resolveClientIp(createRequest({}))).toBe('unknown');
  });

  it('takes the last publicly routable hop from X-Forwarded-For (EdgeOne append semantics)', () => {
    // 客户端伪造的前缀 + EdgeOne 追加的真实 IP：应取最后一跳而非首跳
    const req = createRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 203.0.113.77' });
    expect(resolveClientIp(req)).toBe('203.0.113.77');
  });

  it('skips private addresses appended after the client IP (edge internal hops)', () => {
    const req = createRequest({ 'x-forwarded-for': '1.2.3.4, 10.0.0.9' });
    expect(resolveClientIp(req)).toBe('1.2.3.4');
  });

  it('falls back to the last hop when all addresses are private (local debugging)', () => {
    const req = createRequest({ 'x-forwarded-for': '127.0.0.1, 192.168.1.5' });
    expect(resolveClientIp(req)).toBe('192.168.1.5');
  });

  it('uses a single public XFF entry as-is (CDN overwrite semantics)', () => {
    const req = createRequest({ 'x-forwarded-for': '203.0.113.10' });
    expect(resolveClientIp(req)).toBe('203.0.113.10');
  });

  it('ignores spoofable cf-connecting-ip / x-real-ip headers by default', () => {
    const req = createRequest({
      'cf-connecting-ip': '6.6.6.6',
      'x-real-ip': '7.7.7.7',
      'x-forwarded-for': '8.8.8.8, 203.0.113.99',
    });
    expect(resolveClientIp(req)).toBe('203.0.113.99');
  });

  it('trusts only TRUSTED_CLIENT_IP_HEADER when configured', () => {
    vi.stubEnv('TRUSTED_CLIENT_IP_HEADER', 'EO-Client-IP');
    const req = createRequest({
      'eo-client-ip': '203.0.113.55',
      'x-forwarded-for': '1.2.3.4',
    });
    expect(resolveClientIp(req)).toBe('203.0.113.55');
  });

  it('returns unknown when the configured trusted header is missing', () => {
    vi.stubEnv('TRUSTED_CLIENT_IP_HEADER', 'EO-Client-IP');
    const req = createRequest({ 'x-forwarded-for': '203.0.113.55' });
    expect(resolveClientIp(req)).toBe('unknown');
  });
});

describe('isPubliclyRoutableIp', () => {
  it.each([
    '8.8.8.8',
    '203.0.113.1',
    '1.1.1.1',
    '2606:4700::1',
  ])('treats %s as publicly routable', (ip) => {
    expect(isPubliclyRoutableIp(ip)).toBe(true);
  });

  it.each([
    '10.0.0.1',
    '127.0.0.1',
    '0.0.0.0',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.1.1',
    '100.64.0.1',
    '999.1.1.1',
    '::1',
    '::',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'not-an-ip',
  ])('treats %s as not publicly routable', (ip) => {
    expect(isPubliclyRoutableIp(ip)).toBe(false);
  });

  it('treats public IPv4 ranges just outside private blocks as routable', () => {
    expect(isPubliclyRoutableIp('172.32.0.1')).toBe(true);
    expect(isPubliclyRoutableIp('100.63.255.255')).toBe(true);
    expect(isPubliclyRoutableIp('100.128.0.1')).toBe(true);
  });
});

describe('slidingWindowAllow', () => {
  it('allows up to the limit and rejects afterwards within the window', () => {
    const key = `test:${Math.random()}`;
    const start = 1_700_000_000_000;
    for (let i = 0; i < 3; i += 1) {
      expect(slidingWindowAllow(key, 3, 60_000, start + i)).toBe(true);
    }
    expect(slidingWindowAllow(key, 3, 60_000, start + 3)).toBe(false);
  });

  it('allows again after the window slides past old entries', () => {
    const key = `test:${Math.random()}`;
    const start = 1_700_000_000_000;
    for (let i = 0; i < 3; i += 1) {
      expect(slidingWindowAllow(key, 3, 60_000, start + i)).toBe(true);
    }
    expect(slidingWindowAllow(key, 3, 60_000, start + 60_001)).toBe(true);
  });

  it('isolates buckets by key', () => {
    const base = `test:${Math.random()}`;
    expect(slidingWindowAllow(`${base}:a`, 1, 60_000, 0)).toBe(true);
    expect(slidingWindowAllow(`${base}:b`, 1, 60_000, 0)).toBe(true);
    expect(slidingWindowAllow(`${base}:a`, 1, 60_000, 0)).toBe(false);
  });
});
