'use client';

import { useEffect } from 'react';
import {
  BRAND_FONT_CSS,
  BRAND_FONT_FAMILY,
  BRAND_FONT_PRECONNECT_ID,
  BRAND_FONT_STORAGE_KEY,
  BRAND_FONT_STYLESHEET_ID,
  BRAND_FONT_SWAP_CLASS,
} from '../lib/brand-font';

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

/**
 * 品牌字体真正可用了才写标记：复访时 <head> 的内联脚本据此在首帧前接上字体。
 * 用当前页面实际出现的文字做 sample，只会拉取首屏真正需要的 unicode-range 子集。
 */
function persistBrandFontReady() {
  try {
    if (!document.fonts || typeof document.fonts.load !== 'function') return;
    const raw = document.body?.innerText ?? '';
    const sample = (raw.replace(/\s+/g, ' ').trim() || 'Phigros Query').slice(0, 512);
    document.fonts
      .load(`16px "${BRAND_FONT_FAMILY}"`, sample)
      .catch(() => {})
      .then(() => document.fonts.ready)
      .then(
        () => {
          try {
            localStorage.setItem(BRAND_FONT_STORAGE_KEY, String(Date.now()));
          } catch {
            /* ignore */
          }
        },
        () => {},
      );
  } catch {
    /* ignore */
  }
}

export function BrandFontLoader() {
  useEffect(() => {
    // 复访路径：<head> 的内联脚本已经在首帧前完成加类 + 注入渲染阻塞样式表，
    // 这里只需要补一次「字体已缓存」的时间戳。
    try {
      if (document.getElementById(BRAND_FONT_STYLESHEET_ID)) {
        if (document.documentElement.classList.contains(BRAND_FONT_SWAP_CLASS)) {
          persistBrandFontReady();
        }
        return;
      }
    } catch {
      /* ignore */
    }

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
            document.documentElement.classList.add(BRAND_FONT_SWAP_CLASS);
            persistBrandFontReady();
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
