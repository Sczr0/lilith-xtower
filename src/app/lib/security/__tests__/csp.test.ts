import { describe, expect, it } from 'vitest';

import { buildContentSecurityPolicy } from '../csp';

describe('buildContentSecurityPolicy', () => {
  it('returns a static CSP with wildcard subdomains and WASM support', () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).toContain("wasm-unsafe-eval");
    expect(csp).toContain("https://*.xtower.site");
    expect(csp).toContain("https://*.myalicdn.com");
    expect(csp).toContain("worker-src 'self' blob:");
  });
});
