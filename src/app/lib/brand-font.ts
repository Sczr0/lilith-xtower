/**
 * 品牌字体（Source Han Sans & Saira Hybrid）加载相关的共享常量与工具。
 *
 * 背景：字体包是 cn-font-split 按 unicode-range 切片的 160 个子集（result.css 154KB，
 * 全部子集 5.5MB），所以首屏故意先用系统字体渲染，绝不把字体放进关键路径。
 *
 * 但「懒加载」不等于「每次都要闪」：
 *   - 首访：系统字体 → 字体到达后切换（闪一次，可接受）；
 *   - 复访：字体已在缓存里，就应该在**首帧之前**接上，完全看不到切换。
 *
 * 复访路径靠 localStorage 标记 + <head> 里的内联脚本在首帧前同步加类 + 注入
 * 渲染阻塞样式表实现，详见 BRAND_FONT_BOOTSTRAP（在 layout.tsx 的 <head> 中内联执行）。
 */

export const DEFAULT_BRAND_FONT_CSS =
  '/fonts/Source%20Han%20Sans%20%26%20Saira%20Hybrid-Regular%20%235446/result.css';

export const BRAND_FONT_FAMILY = 'Source Han Sans & Saira Hybrid';

/** 与 globals.css 中 `html.brand-font body` 联动 */
export const BRAND_FONT_SWAP_CLASS = 'brand-font';

export const BRAND_FONT_STYLESHEET_ID = 'brand-font-stylesheet';
export const BRAND_FONT_PRECONNECT_ID = 'brand-font-preconnect';

/** 记录「品牌字体确实已进入缓存」的时间戳；超过 TTL 则不再提前阻塞渲染 */
export const BRAND_FONT_STORAGE_KEY = 'pq.brand-font-cached-at';
export const BRAND_FONT_STORAGE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function normalizeCssHref(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  const wrap = first === last && (first === '"' || first === "'" || first === '`') ? first : null;
  const unwrapped = wrap ? trimmed.slice(1, -1).trim() : trimmed;
  return unwrapped || undefined;
}

export const BRAND_FONT_CSS = (() => {
  const envHref = normalizeCssHref(process.env.NEXT_PUBLIC_BRAND_FONT_CSS);
  return envHref ? envHref : DEFAULT_BRAND_FONT_CSS;
})();

/** 安全地嵌入内联脚本的字符串字面量（避免 `</script>` 提前闭合） */
function jsString(value: string): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * 复访时的「首帧前接管」引导脚本（内联进 <head>，在 HTML 解析阶段同步执行）。
 *
 * 时序要求：必须在浏览器决定首帧之前让浏览器**知道**字体包 CSS 的存在，
 * 这样命中缓存时字体能在首帧前就绪，看不出任何切换。
 *
 * 为什么用 preload + onload 换 rel，而不是渲染阻塞的 <link rel="stylesheet">：
 *   - 阻塞式能保证样式表先于首帧生效，但代价是首帧要等这个 154KB 的 CSS；
 *     品牌字体 CSS 可能来自 CDN（NEXT_PUBLIC_BRAND_FONT_CSS），
 *     其 cache-control 只有 max-age=600，一旦过期/被逐出，首帧就要被拖住。
 *   - preload 同样在解析阶段就发起请求（早于首帧），但不阻塞渲染：
 *     缓存命中时几毫秒内就 onload 成 stylesheet，字体照样赶得上首帧；
 *     真的没命中也不过是这一屏用后备字体（配合 globals.css 的度量匹配，
 *     连位置都不会跳），不会白屏等待。
 *
 * 降级：加载失败时移除 link 与类，交回 BrandFontLoader 的懒加载路径。
 */
export function buildBrandFontBootstrapScript(cssHref: string = BRAND_FONT_CSS): string {
  return [
    '(function(){try{',
    `var t=Number(window.localStorage.getItem(${jsString(BRAND_FONT_STORAGE_KEY)}));`,
    `if(!t||!(Date.now()-t<${BRAND_FONT_STORAGE_TTL_MS}))return;`,
    'var d=document.documentElement,h=document.head,l,p;',
    'try{',
    `p=new URL(${jsString(cssHref)},location.href).origin;`,
    'if(p&&p!==location.origin){var c=document.createElement("link");c.rel="preconnect";c.href=p;c.crossOrigin="anonymous";h.appendChild(c);}',
    '}catch(e){}',
    `d.classList.add(${jsString(BRAND_FONT_SWAP_CLASS)});`,
    'l=document.createElement("link");',
    `l.id=${jsString(BRAND_FONT_STYLESHEET_ID)};`,
    'l.rel="preload";l.as="style";',
    `l.href=${jsString(cssHref)};`,
    'l.onload=function(){try{l.rel="stylesheet";}catch(e){}};',
    `l.onerror=function(){try{l.remove();d.classList.remove(${jsString(BRAND_FONT_SWAP_CLASS)});}catch(e){}};`,
    'h.appendChild(l);',
    '}catch(e){}})();',
  ].join('');
}
