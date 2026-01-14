import { describe, expect, it } from 'vitest';

import { buildContentSecurityPolicy } from '../csp';

describe('buildContentSecurityPolicy', () => {
  it('uses nonce for script-src and does not include unsafe-inline', () => {
    const csp = buildContentSecurityPolicy({ nonce: 'test-nonce' });
    expect(csp).toContain("script-src 'self' 'nonce-test-nonce'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });
});

