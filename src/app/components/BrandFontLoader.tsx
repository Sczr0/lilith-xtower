'use client';

import { useEffect } from 'react';

const DEFAULT_BRAND_FONT_CSS =
  '/fonts/Source%20Han%20Sans%20%26%20Saira%20Hybrid-Regular%20%235446/result.css';

function normalizeCssHref(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  const wrap = (first === last && (first === '"' || first === "'" || first === '`')) ? first : null;
  const unwrapped = wrap ? trimmed.slice(1, -1).trim() : trimmed;
  return unwrapped || undefined;
}

const BRAND_FONT_CSS = (() => {
  const envHref = normalizeCssHref(process.env.NEXT_PUBLIC_BRAND_FONT_CSS);
  return envHref ? envHref : DEFAULT_BRAND_FONT_CSS;
})();

const BRAND_FONT_STYLESHEET_ID = 'brand-font-stylesheet';
const BRAND_FONT_PRECONNECT_ID = 'brand-font-preconnect';

function ensurePreconnect(href: string) {
  try {
    const origin = new URL(href, window.location.origin).origin;
    if (!origin || document.getElementById(BRAND_FONT_PRECONNECT_ID)) return;
    const preconnect = document.createElement('link');
    preconnect.id = BRAND_FONT_PRECONNECT_ID;
    preconnect.rel = 'preconnect';
    preconnect.href = origin;
    preconnect.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect);
  } catch {
    /* ignore */
  }
}

export function BrandFontLoader() {
  useEffect(() => {
    const loadBrandFonts = () => {
      try {
        if (document.getElementById(BRAND_FONT_STYLESHEET_ID)) return;
        ensurePreconnect(BRAND_FONT_CSS);

        const link = document.createElement('link');
        link.id = BRAND_FONT_STYLESHEET_ID;
        link.rel = 'stylesheet';
        link.href = BRAND_FONT_CSS;
        link.media = 'print';
        link.setAttribute('fetchpriority', 'low');
        link.onload = () => {
          try {
            link.media = 'all';
            document.documentElement.classList.add('brand-font');
          } catch {
            /* ignore */
          }
        };
        document.head.appendChild(link);
      } catch {
        /* ignore */
      }
    };

    try {
      // 节省流量/降低数据模式下不加载品牌字体，避免额外请求
      const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      if (conn?.saveData) return;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-data: reduce)').matches) return;
    } catch {
      /* ignore */
    }

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(loadBrandFonts, { timeout: 2000 });
      return () => {
        try {
          w.cancelIdleCallback?.(id);
        } catch {
          /* ignore */
        }
      };
    }

    window.addEventListener('load', loadBrandFonts);
    return () => window.removeEventListener('load', loadBrandFonts);
  }, []);

  return null;
}

export default BrandFontLoader;
