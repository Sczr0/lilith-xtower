import { describe, expect, it } from 'vitest';
import { injectSvgImageCrossOrigin, parseSvgDimensions } from '../svgRenderer';

describe('parseSvgDimensions', () => {
  it('parses width/height attributes', () => {
    const svg = '<svg width="1200" height="4812" viewBox="0 0 1200 4812"></svg>';
    expect(parseSvgDimensions(svg)).toEqual({ width: 1200, height: 4812 });
  });

  it('falls back to viewBox when width/height are not numeric', () => {
    const svg = '<svg width="100%" height="100%" viewBox="0 0 800 600"></svg>';
    expect(parseSvgDimensions(svg)).toEqual({ width: 800, height: 600 });
  });

  it('returns null when svg tag is missing', () => {
    expect(parseSvgDimensions('<div />')).toBeNull();
  });
});

describe('injectSvgImageCrossOrigin', () => {
  it('injects crossorigin for external image href', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://somnia.xtower.site/a.png" /></svg>';
    const patched = injectSvgImageCrossOrigin(svg);
    expect(patched).toContain('<image crossorigin="anonymous"');
  });

  it('does not touch data urls', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,xxx" /></svg>';
    expect(injectSvgImageCrossOrigin(svg)).toEqual(svg);
  });

  it('does not overwrite existing crossorigin', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image crossorigin="use-credentials" href="https://somnia.xtower.site/a.png" /></svg>';
    expect(injectSvgImageCrossOrigin(svg)).toContain('crossorigin="use-credentials"');
  });
});
