import { describe, expect, it } from 'vitest';

import { safeJsonLdStringify } from '../safeJsonLdStringify';

describe('safeJsonLdStringify', () => {
  it('escapes < to prevent script tag boundary issues', () => {
    const text = safeJsonLdStringify({ html: '<script>alert(1)</script>' });
    expect(text).toContain('\\u003cscript>');
    expect(text).not.toContain('<script>');
  });
});

