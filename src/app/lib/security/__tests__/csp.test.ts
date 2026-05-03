import { describe, expect, it } from 'vitest';

import { buildContentSecurityPolicy } from '../csp';

describe('buildContentSecurityPolicy', () => {
  it('returns a static CSP with explicit script-src allowlist', () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://cloud.umami.is");
  });
});
