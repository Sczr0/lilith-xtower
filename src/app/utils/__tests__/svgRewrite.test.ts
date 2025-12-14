import { describe, expect, it } from 'vitest';
import { rewriteSvgImageHrefs } from '../svgRewrite';

describe('rewriteSvgImageHrefs', () => {
  it('rewrites https image href inside <image>', () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://somnia.xtower.site/a.png" /></svg>';
    const output = rewriteSvgImageHrefs(input, (url) => `/proxy?url=${encodeURIComponent(url)}`);
    expect(output).toContain('<image href="/proxy?url=');
  });

  it('does not rewrite non-http href', () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,xxx" /></svg>';
    const output = rewriteSvgImageHrefs(input, () => '/proxy');
    expect(output).toEqual(input);
  });

  it('supports xlink:href with single quotes', () => {
    const input =
      "<svg xmlns=\"http://www.w3.org/2000/svg\"><image xlink:href='https://somnia.xtower.site/a.png' /></svg>";
    const output = rewriteSvgImageHrefs(input, () => '/proxy');
    expect(output).toContain('xlink:href="/proxy"');
  });
});

