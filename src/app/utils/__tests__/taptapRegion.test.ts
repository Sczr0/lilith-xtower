import { describe, expect, it } from 'vitest';
import {
  detectTapTapRegionFromHtml,
  tapTapVersionFromDetection,
  TAPTAP_BLOCK_PHRASE,
} from '../taptapRegion';

describe('detectTapTapRegionFromHtml', () => {
  it('returns domestic when block phrase is present', () => {
    const html = `<html><body><p>${TAPTAP_BLOCK_PHRASE}</p></body></html>`;
    const result = detectTapTapRegionFromHtml(html);

    expect(result.containsBlockPhrase).toBe(true);
    expect(result.isInternational).toBe(false);
    expect(tapTapVersionFromDetection(result)).toBe('CN');
  });

  it('returns international when block phrase is absent', () => {
    const html = '<html><body><p>Welcome to TapTap</p></body></html>';
    const result = detectTapTapRegionFromHtml(html);

    expect(result.containsBlockPhrase).toBe(false);
    expect(result.isInternational).toBe(true);
    expect(tapTapVersionFromDetection(result)).toBe('Global');
  });
});
