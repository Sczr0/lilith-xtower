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

  it('放行阿里云 ESA RUM 拨测域名，但仅限 connect-src', () => {
    const directives = new Map(
      buildContentSecurityPolicy()
        .split('; ')
        .map((part) => {
          const [name, ...values] = part.split(' ');
          return [name, values];
        }),
    );

    expect(directives.get('connect-src')).toContain('https://*.ialicdn.com');
    // 拨测只用 fetch，不应因此放开脚本/图片等其它来源
    expect(directives.get('script-src')).not.toContain('https://*.ialicdn.com');
    expect(directives.get('img-src')).not.toContain('https://*.ialicdn.com');
  });
});
