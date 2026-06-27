import { describe, it, expect } from 'vitest';
import { isEtagFresh, computeWeakEtag } from '../httpCache';

describe('isEtagFresh', () => {
  it('returns false for null if-none-match', () => {
    expect(isEtagFresh(null, 'W/"abc"')).toBe(false);
  });

  it('returns false for empty if-none-match', () => {
    expect(isEtagFresh('', 'W/"abc"')).toBe(false);
  });

  it('handles exact match', () => {
    expect(isEtagFresh('W/"abc"', 'W/"abc"')).toBe(true);
  });

  it('handles wildcard *', () => {
    expect(isEtagFresh('*', 'W/"abc"')).toBe(true);
  });

  it('handles wildcard * with surrounding spaces', () => {
    expect(isEtagFresh(' * ', 'W/"abc"')).toBe(true);
  });

  it('handles multiple etags (comma separated)', () => {
    expect(isEtagFresh('W/"aaa", W/"bbb", W/"ccc"', 'W/"bbb"')).toBe(true);
  });

  it('handles strong etag vs weak etag comparison', () => {
    expect(isEtagFresh('"abc"', 'W/"abc"')).toBe(true);
  });

  it('handles weak etag vs strong etag comparison (client weak, server strong)', () => {
    // 客户端缓存弱 ETag，服务器当前有强 ETag（哈希值匹配 → 视为 fresh）
    expect(isEtagFresh('W/"abc"', '"abc"')).toBe(true);
  });

  it('returns false for mismatched etag', () => {
    expect(isEtagFresh('W/"xyz"', 'W/"abc"')).toBe(false);
  });

  it('handles etags with spaces around commas', () => {
    expect(isEtagFresh('W/"abc" , W/"def"', 'W/"def"')).toBe(true);
  });

  it('handles quoted etag with no W/ prefix', () => {
    expect(isEtagFresh('"abc"', '"abc"')).toBe(true);
  });
});

describe('computeWeakEtag', () => {
  it('produces valid weak etag', () => {
    const etag = computeWeakEtag('hello');
    expect(etag).toMatch(/^W\/"/);
    expect(etag.endsWith('"')).toBe(true);
  });

  it('produces stable output for same input', () => {
    expect(computeWeakEtag('hello')).toBe(computeWeakEtag('hello'));
  });

  it('produces different output for different input', () => {
    expect(computeWeakEtag('hello')).not.toBe(computeWeakEtag('world'));
  });

  it('handles Buffer input', () => {
    const buffer = Buffer.from('test buffer payload');
    const etag = computeWeakEtag(buffer);
    expect(etag).toMatch(/^W\/"/);
    expect(isEtagFresh(etag, etag)).toBe(true);
  });
});
