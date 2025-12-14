import { describe, expect, it } from 'vitest';
import { parseSvgDimensions } from '../svgRenderer';

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

