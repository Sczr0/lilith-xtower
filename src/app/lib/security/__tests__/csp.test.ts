import { describe, expect, it } from 'vitest';

import { buildContentSecurityPolicy } from '../csp';

describe('buildContentSecurityPolicy', () => {
  it('uses nonce for script-src and keeps a strict explicit allowlist', () => {
    const csp = buildContentSecurityPolicy({ nonce: 'test-nonce' });
    expect(csp).toContain("script-src 'self' 'nonce-test-nonce' https://cloud.umami.is");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toMatch(/script-src[^;]*(?:^|\s)https:(?:\s|$)/);
    expect(csp).not.toMatch(/script-src[^;]*(?:^|\s)http:(?:\s|$)/);
  });
});
