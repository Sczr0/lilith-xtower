import { describe, expect, it, vi } from 'vitest';
import {
  embedSvgExternalImagesAsObjectUrls,
  injectSvgImageCrossOrigin,
  inlineSvgExternalImages,
  parseSvgDimensions,
  rewriteCssRelativeUrls,
} from '../svgRenderer';

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

  it('injects crossorigin for protocol-relative href', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="//somnia.xtower.site/a.png" /></svg>';
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

describe('inlineSvgExternalImages', () => {
  it('inlines external images as data urls', async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://somnia.xtower.site/a.png" /></svg>';

    globalThis.fetch = (async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      })) as unknown as typeof fetch;

    const out = await inlineSvgExternalImages(svg, { maxCount: 10 });
    expect(out).toContain('href="data:image/png;base64,');
  });

  it('inlines root-relative href using baseUrl', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><image href="/a.png" /></svg>';
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toBe('https://example.com/a.png');
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const out = await inlineSvgExternalImages(svg, { maxCount: 10, baseUrl: 'https://example.com/demo' });
    expect(out).toContain('href="data:image/png;base64,');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when image count exceeds max', async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<image href="https://somnia.xtower.site/1.png" />' +
      '<image href="https://somnia.xtower.site/2.png" />' +
      '</svg>';
    await expect(() => inlineSvgExternalImages(svg, { maxCount: 1 })).rejects.toThrow('外链图片过多');
  });
});

describe('embedSvgExternalImagesAsObjectUrls', () => {
  it('replaces external href with blob url and returns revoke', async () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const created: string[] = [];
    URL.createObjectURL = ((_blob: Blob) => {
      void _blob;
      const u = `blob:mock-${created.length}`;
      created.push(u);
      return u;
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => {}) as unknown as typeof URL.revokeObjectURL;

    globalThis.fetch = (async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      })) as unknown as typeof fetch;

    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://somnia.xtower.site/a.png" /></svg>';
    const embedded = await embedSvgExternalImagesAsObjectUrls(svg, { maxCount: 10, concurrency: 2 });
    expect(embedded.svgText).toContain('href="blob:mock-0"');
    expect(Array.isArray(embedded.objectUrls)).toBe(true);
    expect(typeof embedded.revoke).toBe('function');

    embedded.revoke();

    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  it('replaces root-relative href using baseUrl', async () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = ((_blob: Blob) => {
      void _blob;
      return 'blob:mock-0';
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => {}) as unknown as typeof URL.revokeObjectURL;

    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toBe('https://example.com/a.png');
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><image href="/a.png" /></svg>';
    const embedded = await embedSvgExternalImagesAsObjectUrls(svg, { maxCount: 10, concurrency: 2, baseUrl: 'https://example.com/demo' });
    expect(embedded.svgText).toContain('href="blob:mock-0"');
    expect(Array.isArray(embedded.objectUrls)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    embedded.revoke();

    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });
});

describe('rewriteCssRelativeUrls', () => {
  it('rewrites ./ paths with quotes', () => {
    const css = '@font-face{src:url("./a.woff2") format("woff2");}';
    expect(rewriteCssRelativeUrls(css, 'https://example.com/fonts/pack/')).toContain(
      'url("https://example.com/fonts/pack/a.woff2")',
    );
  });

  it('rewrites ./ paths without quotes', () => {
    const css = '@font-face{src:url(./a.woff2) format("woff2");}';
    expect(rewriteCssRelativeUrls(css, 'https://example.com/fonts/pack')).toContain(
      'url("https://example.com/fonts/pack/a.woff2")',
    );
  });
});
