import { describe, expect, it } from 'vitest';
import { sanitizeWithHeadingIds } from './sanitize-precompiled-html.mjs';

describe('sanitizeWithHeadingIds', () => {
  it('removes scripts and event handler attributes', () => {
    const html = [
      '<p>Hello</p>',
      '<script>alert(1)</script>',
      '<img src="https://example.com/a.png" onerror="alert(1)" alt="x" />',
      '<a href="javascript:alert(1)" onclick="alert(2)">x</a>',
    ].join('\n');

    const out = sanitizeWithHeadingIds(html);
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/\sonerror\s*=/i);
    expect(out).not.toMatch(/\sonclick\s*=/i);
    expect(out).not.toMatch(/javascript:/i);
  });

  it('injects stable heading ids and preserves explicit data-heading-id', () => {
    const html = [
      '<h2>Title</h2>',
      '<h3 data-heading-id="custom-id">X</h3>',
    ].join('\n');

    const out = sanitizeWithHeadingIds(html);
    expect(out).toContain('data-heading-id="heading-0"');
    expect(out).toContain('id="heading-0"');
    expect(out).toContain('data-heading-id="custom-id"');
    expect(out).toContain('id="custom-id"');
  });

  it('adds rel to external links', () => {
    const out = sanitizeWithHeadingIds('<a href="https://example.com">x</a>');
    expect(out).toContain('rel="');
    expect(out).toContain('noopener');
    expect(out).toContain('noreferrer');
  });
});

