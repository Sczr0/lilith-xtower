export interface RenderOptions {
  format?: 'png' | 'jpg' | 'webp';
  quality?: number;
  scale?: number;
  backgroundColor?: string;
  baseUrl?: string;
  // 调试开关：输出极其详细的控制台日志（仅用于排查导出缺封面等问题）
  debug?: boolean;
  // 调试日志前缀，便于在控制台过滤
  debugTag?: string;
  waitBeforeDrawMs?: number;
  fontPackId?: 'source-han-sans-saira-hybrid-5446';
  fontFamily?: string;
  // 是否将字体包内的字体文件嵌入到 SVG（data: URL），用于解决“SVG 作为 blob/img 渲染时字体不生效”的问题
  // 说明：blob/data URL 的 SVG 子资源请求通常会带 Origin: null，若字体文件未放行 CORS，会导致字体加载失败；
  // 嵌入 data: 可避免跨域与时序问题，但会增大 SVG 字符串体积。
  embedFonts?: 'none' | 'data';
  // embedFonts='data' 时最多嵌入的字体文件数量（防止极端情况下体积/内存失控）
  embedFontMaxFiles?: number;
  // 是否在渲染前将 SVG 内的外链图片(<image href>)抓取并内联为 data:URL
  // 目的：避免导出到 canvas 时外链图片因跨域/安全策略不参与渲染，导致导出缺图。
  //
  // 建议：当图片数量很多（例如 Best100）时，优先使用 embedImages='object'，
  // 以 blob: URL 方式嵌入，避免 base64 内联造成内存暴涨。
  inlineImages?: boolean;
  // 内联图片的最大数量（按去重后的 URL 计），避免 N 很大时内存/带宽失控
  inlineImageMaxCount?: number;
  // 外链图片嵌入策略：
  // - 'none'：不处理
  // - 'data'：抓取并替换为 data: URL（体积大，适合少量）
  // - 'object'：抓取为 Blob 并替换为 blob: URL（更省内存，适合大量）
  embedImages?: 'none' | 'data' | 'object';
  // 抓取图片的并发数（避免一次性请求过多导致卡顿或触发限流）
  embedImageConcurrency?: number;
  // 允许嵌入图片的最大数量（按去重后的 URL 计）
  embedImageMaxCount?: number;
}

export interface RenderProgress {
  stage: 'loading-fonts' | 'fetching-images' | 'rendering' | 'encoding' | 'complete';
  progress: number;
}

function debugEnabled(options?: { debug?: boolean }): boolean {
  return !!options?.debug;
}

function debugPrefix(options?: { debugTag?: string }): string {
  return options?.debugTag ? `[${options.debugTag}]` : '[SVGRenderer]';
}

function dlog(options: { debug?: boolean; debugTag?: string } | undefined, ...args: unknown[]) {
  if (!debugEnabled(options)) return;
  try {
    // eslint-disable-next-line no-console
    console.log(debugPrefix(options), ...args);
  } catch {}
}

function dgroup(
  options: { debug?: boolean; debugTag?: string } | undefined,
  title: string,
  fn: () => void,
) {
  if (!debugEnabled(options)) return fn();
  const prefix = debugPrefix(options);
  try {
    // eslint-disable-next-line no-console
    console.group(`${prefix} ${title}`);
    fn();
    // eslint-disable-next-line no-console
    console.groupEnd();
  } catch {
    fn();
  }
}

function nowMs(): number {
  try {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  } catch {}
  return Date.now();
}

export function injectSvgStyle(rawSvg: string, css: string): string {
  const safeCss = sanitizeSvgXmlText(css).text;
  if (/<style[\s>]/i.test(rawSvg) && /<\/style>/i.test(rawSvg)) {
    return rawSvg.replace(/<\/style>/i, `${safeCss}\n</style>`);
  }
  if (/<defs[\s>]/i.test(rawSvg) && /<\/defs>/i.test(rawSvg)) {
    return rawSvg.replace(/<\/defs>/i, `<style>\n${safeCss}\n</style>\n</defs>`);
  }
  return rawSvg.replace(/<svg\b([^>]*)>/i, `<svg$1><style>\n${safeCss}\n</style>`);
}

export function rewriteCssRelativeUrls(cssText: string, baseUrl: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const withQuotes = cssText.replace(/url\(\s*(['"])\.\/([^'"]+)\1\s*\)/g, (_m, _q, path) => {
    return `url("${base}${path}")`;
  });
  return withQuotes.replace(/url\(\s*\.\/([^)"'\s]+)\s*\)/g, (_m, path) => {
    return `url("${base}${path}")`;
  });
}

function decodeXmlCharacterReferences(input: string): string {
  // 目的：SVG 中 href/xlink:href 可能包含 &amp; 等字符引用；我们在用 fetch 抓取外链图片时需要先解码，
  // 否则会把 “&amp;” 当作字面量导致请求 URL 错误（而浏览器真实解析 SVG 时会自动解码）。
  return input.replace(/&(#\d+|#x[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (raw, body) => {
    switch (body) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
    }

    try {
      if (body.startsWith('#x')) {
        const codePoint = Number.parseInt(body.slice(2), 16);
        if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return raw;
        return String.fromCodePoint(codePoint);
      }
      if (body.startsWith('#')) {
        const codePoint = Number.parseInt(body.slice(1), 10);
        if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return raw;
        return String.fromCodePoint(codePoint);
      }
    } catch {}

    return raw;
  });
}

export function sanitizeSvgXmlText(svgText: string): { text: string; fixed: number } {
  // 目的：DOMParser('image/svg+xml') 对 XML 更严格；若 SVG 含有未转义的 “&” 或未定义实体，会导致解析失败，
  // 进而出现 “Invalid SVG: ... xmlParseEntityRef: no name” 这类错误并中断导出。
  //
  // 策略：
  // - 仅保留 XML 预定义实体（amp/lt/gt/quot/apos）与数值字符引用（&#...; / &#x...;）
  // - 其余 “&...;” 视为未定义实体，转义为字面量（即把 '&' 变为 '&amp;'）
  // - 避免改写 CDATA（CDATA 内允许 '&'，但转义会改变语义）
  let fixed = 0;
  let out = '';

  let i = 0;
  while (i < svgText.length) {
    if (svgText.startsWith('<![CDATA[', i)) {
      const end = svgText.indexOf(']]>', i + 9);
      if (end === -1) {
        out += svgText.slice(i);
        break;
      }
      out += svgText.slice(i, end + 3);
      i = end + 3;
      continue;
    }

    const ch = svgText[i];
    if (ch !== '&') {
      out += ch;
      i += 1;
      continue;
    }

    const semi = svgText.indexOf(';', i + 1);
    if (semi === -1) {
      out += '&amp;';
      fixed += 1;
      i += 1;
      continue;
    }

    const body = svgText.slice(i + 1, semi);
    const isNumericEntity = /^#\d+$/.test(body) || /^#x[0-9a-fA-F]+$/.test(body);
    const isPredefined =
      body === 'amp' || body === 'lt' || body === 'gt' || body === 'quot' || body === 'apos';

    if (isNumericEntity || isPredefined) {
      out += svgText.slice(i, semi + 1);
      i = semi + 1;
      continue;
    }

    out += '&amp;';
    fixed += 1;
    i += 1;
  }

  if (fixed === 0) return { text: svgText, fixed: 0 };
  return { text: out, fixed };
}

const FONT_PACKS: Record<
  NonNullable<RenderOptions['fontPackId']>,
  { dirName: string; defaultFamily: string }
> = {
  'source-han-sans-saira-hybrid-5446': {
    dirName: 'Source Han Sans & Saira Hybrid-Regular #5446',
    defaultFamily: 'Source Han Sans & Saira Hybrid',
  },
};

const cachedFontPackCss: Record<string, Promise<string>> = {};
const cachedFontPackInjected: Record<string, Promise<void>> = {};

type UnicodeRange = { start: number; end: number };

function parseUnicodeRangeList(raw: string): UnicodeRange[] {
  // 示例：U+4E00,U+4E0A-4E0B,U+FF01-U+FF5E
  const ranges: UnicodeRange[] = [];
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  for (const part of parts) {
    const m = /^U\+([0-9A-Fa-f]{1,6})(?:-([0-9A-Fa-f]{1,6}))?$/.exec(part);
    if (!m) continue;
    const start = Number.parseInt(m[1]!, 16);
    const end = Number.parseInt((m[2] ?? m[1])!, 16);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (start < 0 || end < 0 || start > 0x10ffff || end > 0x10ffff) continue;
    ranges.push({ start: Math.min(start, end), end: Math.max(start, end) });
  }
  return ranges;
}

function collectSvgUsedCodePoints(svgText: string): Set<number> {
  // 目的：只嵌入本次导出真正用到的字体子集（unicode-range），避免把整个字体包塞进 data:URL。
  const used = new Set<number>();
  if (typeof DOMParser === 'undefined') return used;
  try {
    const sanitized = sanitizeSvgXmlText(svgText);
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(sanitized.text, 'image/svg+xml');
    const texts = Array.from(svgDoc.querySelectorAll('text'));
    for (const el of texts) {
      const t = el.textContent ?? '';
      for (const ch of t) {
        if (!ch.trim()) continue;
        used.add(ch.codePointAt(0)!);
      }
    }
  } catch {
    // ignore
  }
  return used;
}

function cssFontMimeTypeFromUrl(url: string, contentType: string | null): string {
  const lower = url.toLowerCase();
  if (contentType && /^font\//i.test(contentType)) return contentType.split(';')[0]!;
  if (contentType && /woff2/i.test(contentType)) return 'font/woff2';
  if (contentType && /woff/i.test(contentType)) return 'font/woff';
  if (lower.endsWith('.woff2')) return 'font/woff2';
  if (lower.endsWith('.woff')) return 'font/woff';
  if (lower.endsWith('.otf')) return 'font/otf';
  if (lower.endsWith('.ttf')) return 'font/ttf';
  return 'application/octet-stream';
}

function extractFontFaceBlocks(cssText: string): string[] {
  // result.css 是 minify 的多个 @font-face{...} 拼接，简单正则即可拆分
  return cssText.match(/@font-face\s*{[^}]*}/g) ?? [];
}

function pickFontFaceBlocksForCodePoints(fontFaceBlocks: string[], usedCodePoints: Set<number>): string[] {
  if (fontFaceBlocks.length === 0) return [];
  // 若 SVG 没有文字，仍然返回空（避免无意义地塞字体）
  if (usedCodePoints.size === 0) return [];

  const used = Array.from(usedCodePoints.values());
  const picked: string[] = [];

  for (const block of fontFaceBlocks) {
    const m = /unicode-range\s*:\s*([^;]+)\s*;/i.exec(block);
    // 没有 unicode-range 的规则：保守起见跳过（否则可能把整套字体塞进去）
    if (!m) continue;
    const ranges = parseUnicodeRangeList(m[1] ?? '');
    if (ranges.length === 0) continue;

    let hit = false;
    for (const cp of used) {
      for (const r of ranges) {
        if (cp >= r.start && cp <= r.end) {
          hit = true;
          break;
        }
      }
      if (hit) break;
    }

    if (hit) picked.push(block);
  }

  return picked;
}

function extractCssUrls(block: string): string[] {
  const urls: string[] = [];
  const re = /url\(\s*(['"]?)([^"')]+)\1\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const u = (m[2] ?? '').trim();
    if (!u) continue;
    if (/^(data:|blob:)/i.test(u)) continue;
    urls.push(u);
  }
  return urls;
}

async function getFontPackCss(
  packId: NonNullable<RenderOptions['fontPackId']>,
  baseUrl: string | undefined,
  options: { debug?: boolean; debugTag?: string } | undefined,
): Promise<{ css: string; family: string }> {
  const pack = FONT_PACKS[packId];
  const origin =
    (() => {
      if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
      if (baseUrl) {
        try {
          return new URL(baseUrl).origin;
        } catch {}
      }
      return '';
    })();
  if (!origin) throw new Error('font pack requires window.location.origin or baseUrl');

  const dirPath = `/fonts/${encodeURIComponent(pack.dirName)}/`;
  const dirUrl = new URL(dirPath, origin).toString();
  const cssUrl = new URL('result.css', dirUrl).toString();
  const cacheKey = `${packId}|${cssUrl}`;

  if (!cachedFontPackCss[cacheKey]) {
    cachedFontPackCss[cacheKey] = (async () => {
      dlog(options, 'fontPack css fetch', { cssUrl });
      const res = await fetch(cssUrl, { method: 'GET' });
      if (!res.ok) throw new Error(`Failed to load font pack css: ${res.status} ${cssUrl}`);
      const text = await res.text();
      return rewriteCssRelativeUrls(text, dirUrl);
    })();
  }

  return { css: await cachedFontPackCss[cacheKey]!, family: pack.defaultFamily };
}

function cssStringLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function collectSvgTextSample(svgText: string, maxUniqueChars = 600): string {
  if (typeof DOMParser === 'undefined') return '';
  try {
    const sanitized = sanitizeSvgXmlText(svgText);
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(sanitized.text, 'image/svg+xml');
    const texts = Array.from(svgDoc.querySelectorAll('text'));
    const set = new Set<string>();
    for (const el of texts) {
      const t = el.textContent ?? '';
      for (const ch of t) {
        if (!ch.trim()) continue;
        set.add(ch);
        if (set.size >= maxUniqueChars) break;
      }
      if (set.size >= maxUniqueChars) break;
    }
    return Array.from(set).join('');
  } catch {
    return '';
  }
}

async function ensureFontPackInjectedToDocument(
  packId: NonNullable<RenderOptions['fontPackId']>,
  baseUrl: string | undefined,
  options: { debug?: boolean; debugTag?: string } | undefined,
): Promise<{ family: string }> {
  if (typeof document === 'undefined') return { family: FONT_PACKS[packId].defaultFamily };

  const cacheKey = `${packId}|${baseUrl ?? ''}`;
  if (!cachedFontPackInjected[cacheKey]) {
    cachedFontPackInjected[cacheKey] = (async () => {
      const { css } = await getFontPackCss(packId, baseUrl, options);
      const existing = document.querySelector(`style[data-font-pack="${packId}"]`);
      if (existing) return;
      const style = document.createElement('style');
      style.setAttribute('data-font-pack', packId);
      style.textContent = css;
      document.head.appendChild(style);
      dlog(options, 'fontPack injected into document', { packId });
    })();
  }

  await cachedFontPackInjected[cacheKey]!;
  return { family: FONT_PACKS[packId].defaultFamily };
}

async function buildEmbeddedFontCssForSvg(
  svgText: string,
  packId: NonNullable<RenderOptions['fontPackId']>,
  baseUrl: string | undefined,
  options: { debug?: boolean; debugTag?: string } | undefined,
  maxFiles: number,
): Promise<{ css: string; embeddedFiles: number }> {
  // 目的：把字体包的 @font-face 规则与字体文件内联到 SVG，确保 blob/data URL 渲染时字体也能生效。
  const { css } = await getFontPackCss(packId, baseUrl, options);

  const blocks = extractFontFaceBlocks(css);
  const used = collectSvgUsedCodePoints(svgText);
  const picked = pickFontFaceBlocksForCodePoints(blocks, used);
  if (picked.length === 0) return { css: '', embeddedFiles: 0 };

  const urls = Array.from(new Set(picked.flatMap(extractCssUrls)));
  if (urls.length === 0) return { css: picked.join('\n'), embeddedFiles: 0 };

  const limit = Math.max(0, Math.min(256, Math.floor(maxFiles)));
  if (urls.length > limit) {
    dlog(options, 'embedFonts skipped: too many font files', { files: urls.length, limit });
    return { css: '', embeddedFiles: 0 };
  }

  const dataUrlByUrl = new Map<string, string>();
  for (const url of urls) {
    try {
      const res = await fetch(url, getFetchInitForUrl(url));
      if (!res.ok) throw new Error(`Failed to fetch font: ${res.status} ${url}`);
      const buf = await res.arrayBuffer();
      const mime = cssFontMimeTypeFromUrl(url, res.headers.get('content-type'));
      const dataUrl = `data:${mime};base64,${arrayBufferToBase64(buf)}`;
      dataUrlByUrl.set(url, dataUrl);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      dlog(options, 'embedFonts fetch failed', { url, message });
      // 某个子集失败不应阻断导出：跳过，交给后续 fallback（可能使用系统字体/已有字体）
    }
  }

  if (dataUrlByUrl.size === 0) return { css: '', embeddedFiles: 0 };

  const replaceAllUrls = (input: string): string => {
    let out = input;
    for (const [from, to] of dataUrlByUrl.entries()) {
      out = out.replace(
        new RegExp(`url\\(\\s*(['"]?)${escapeRegExp(from)}\\1\\s*\\)`, 'g'),
        `url("${to}")`,
      );
    }
    return out;
  };

  const embeddedCss = picked.map(replaceAllUrls).join('\n');
  return { css: embeddedCss, embeddedFiles: dataUrlByUrl.size };
}

async function preloadDocumentFont(
  family: string,
  sampleText: string,
  options: { debug?: boolean; debugTag?: string } | undefined,
): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const start = nowMs();
  try {
    const sample = (sampleText || '').slice(0, 2048);
    await document.fonts.load(`16px "${family}"`, sample);
    await document.fonts.load(`16px "${family}"`, '0123456789APFCIN');
    await document.fonts.ready;
    dlog(options, 'font preloaded', { family, ms: Math.round(nowMs() - start), sampleLength: sample.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    dlog(options, 'font preload failed', { family, message });
  }
}

export function injectSvgImageCrossOrigin(svgText: string): string {
  // 将 SVG 内 <image> 的外链资源按 CORS 模式加载，否则 canvas 可能被污染（tainted）导致无法导出。
  // 只对带 http(s) href/xlink:href 且未声明 crossorigin 的 <image> 注入。
  return svgText.replace(/<image\b[^>]*>/gi, (tag) => {
    if (/\bcrossorigin\s*=/i.test(tag)) return tag;
    if (!/\b(?:href|xlink:href)\s*=\s*["'](?:https?:\/\/|\/\/)/i.test(tag)) return tag;
    return tag.replace(/<image\b/i, '<image crossorigin="anonymous"');
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  // Node 环境（vitest）优先使用 Buffer；浏览器环境使用 btoa
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AnyBuffer = (globalThis as any).Buffer as typeof Buffer | undefined;
  if (typeof AnyBuffer !== 'undefined') {
    return AnyBuffer.from(buffer).toString('base64');
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

type SvgImageRef = {
  originalUrl: string;
  fetchUrl: string;
};

function normalizeSvgImageHref(rawHref: string, baseUrl?: string): string | null {
  const href = decodeXmlCharacterReferences(rawHref).trim();
  if (!href) return null;
  if (/^(data:|blob:)/i.test(href)) return null;
  if (href.startsWith('#')) return null;
  if (/^https?:\/\//i.test(href)) return href;
  if (/^\/\//.test(href)) {
    const protocol =
      typeof window !== 'undefined' && window.location?.protocol ? window.location.protocol : 'https:';
    return `${protocol}${href}`;
  }

  const effectiveBase =
    baseUrl ??
    (typeof document !== 'undefined' && document.baseURI ? document.baseURI : undefined);
  if (!effectiveBase) return null;

  try {
    return new URL(href, effectiveBase).toString();
  } catch {
    return null;
  }
}

function getFetchInitForUrl(url: string): RequestInit {
  if (typeof window === 'undefined') {
    return { method: 'GET' };
  }

  try {
    const target = new URL(url);
    if (target.origin === window.location.origin) {
      return { method: 'GET', mode: 'same-origin', credentials: 'include' };
    }
    return { method: 'GET', mode: 'cors', credentials: 'omit' };
  } catch {
    return { method: 'GET' };
  }
}

function collectExternalSvgImages(svgText: string, baseUrl?: string): SvgImageRef[] {
  const seenOriginal = new Set<string>();
  const refs: SvgImageRef[] = [];
  const regex = /<image\b[^>]*\s(?:href|xlink:href)\s*=\s*(["'])([^"']+)\1[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(svgText))) {
    const originalUrl = match[2] ?? '';
    if (!originalUrl) continue;
    if (seenOriginal.has(originalUrl)) continue;

    const fetchUrl = normalizeSvgImageHref(originalUrl, baseUrl);
    if (!fetchUrl) continue;

    seenOriginal.add(originalUrl);
    refs.push({ originalUrl, fetchUrl });
  }

  return refs;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectSvgImageUrlsForPreload(svgText: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const regex = /<image\b[^>]*\s(?:href|xlink:href)\s*=\s*(["'])([^"']+)\1[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(svgText))) {
    const href = (match[2] ?? '').trim();
    if (!href) continue;
    if (!/^(data:|blob:)/i.test(href)) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    urls.push(href);
  }
  return urls;
}

export async function inlineSvgExternalImages(
  svgText: string,
  options: {
    maxCount: number;
    baseUrl?: string;
    concurrency?: number;
    debug?: boolean;
    debugTag?: string;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<string> {
  const start = nowMs();
  dgroup(options, 'inlineSvgExternalImages:start', () => {
    dlog(options, 'svgText.length =', svgText.length);
    dlog(options, 'baseUrl =', options.baseUrl);
    try {
      dlog(options, 'document.baseURI =', typeof document !== 'undefined' ? document.baseURI : '(no document)');
    } catch {}
    try {
      dlog(options, 'location.href =', typeof window !== 'undefined' ? window.location.href : '(no window)');
    } catch {}
    const imageTagCount = (svgText.match(/<image\b/gi) ?? []).length;
    dlog(options, '<image> tags =', imageTagCount);
    const imageTags = svgText.match(/<image\b[^>]*>/gi) ?? [];
    dlog(options, '<image> tag samples =', imageTags.slice(0, 20));
    const unquotedHref = svgText.match(/\b(?:href|xlink:href)\s*=\s*[^"'\s>]+/gi) ?? [];
    dlog(options, 'unquoted href samples =', unquotedHref.slice(0, 20));
    const urlMatches = svgText.match(/url\(([^)]+)\)/gi);
    dlog(options, 'CSS url(...) matches =', urlMatches?.length ?? 0, urlMatches?.slice(0, 20));
  });

  const refs = collectExternalSvgImages(svgText, options.baseUrl);
  dlog(options, 'collected refs =', refs);
  if (refs.length === 0) return svgText;
  if (refs.length > options.maxCount) {
    throw new Error(`SVG 外链图片过多（${refs.length}），请降低 N 或关闭内联导出。`);
  }

  const cache = new Map<string, string>(); // fetchUrl -> dataURL
  let done = 0;
  const total = refs.length;

  const replaceUrl = (input: string, from: string, to: string) =>
    input.replace(
      new RegExp(
        `(\\b(?:href|xlink:href)\\s*=\\s*["'])${escapeRegExp(from)}(["'])`,
        'g',
      ),
      `$1${to}$2`,
    );

  // 并发抓取所有外链图片并写入 cache，避免逐个 fetch 导致耗时过长（并发会让导出更稳定）
  const uniqueFetchUrls = Array.from(new Set(refs.map((r) => r.fetchUrl)));
  const concurrency = Math.max(1, Math.min(16, Math.floor(options.concurrency ?? 6)));
  const fetchQueue = uniqueFetchUrls.slice();
  const fetchWorkers = Array.from(
    { length: Math.min(concurrency, fetchQueue.length || 1) },
    async () => {
      while (fetchQueue.length) {
        const fetchUrl = fetchQueue.shift();
        if (!fetchUrl) return;
        if (cache.has(fetchUrl)) continue;

        dgroup(options, `inline:fetch:${fetchUrl}`, () => {
          dlog(options, 'fetchInit =', getFetchInitForUrl(fetchUrl));
        });

        const fetchStart = nowMs();
        const res = await fetch(fetchUrl, getFetchInitForUrl(fetchUrl));
        if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} ${fetchUrl}`);
        dlog(options, 'fetch ok', { status: res.status, ms: Math.round(nowMs() - fetchStart) });
        const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
        const buf = await res.arrayBuffer();
        const b64 = arrayBufferToBase64(buf);
        cache.set(fetchUrl, `data:${contentType};base64,${b64}`);
      }
    },
  );
  await Promise.all(fetchWorkers);

  let out = svgText;

  // 关键：按 URL 长度降序排列，优先替换长 URL。
  // 避免短 URL 是长 URL 的前缀/子串时，先替换短 URL 导致长 URL 被破坏（例如变成 "data:...?param=val"），
  // 进而导致 XML 解析错误（如 "xmlParseEntityRef: no name"，因为破坏后的 URL 可能包含裸露的 '&'）。
  const sortedRefs = refs.slice().sort((a, b) => b.originalUrl.length - a.originalUrl.length);

  for (const { originalUrl, fetchUrl } of sortedRefs) {
    dgroup(options, `inline:image:${originalUrl}`, () => {
      dlog(options, 'fetchUrl =', fetchUrl);
      dlog(options, 'fetchInit =', getFetchInitForUrl(fetchUrl));
      try {
        const occurrences = out.split(originalUrl).length - 1;
        dlog(options, 'occurrences(before) =', occurrences);
      } catch {}
    });
    if (!cache.has(fetchUrl)) {
      const fetchStart = nowMs();
      const res = await fetch(fetchUrl, getFetchInitForUrl(fetchUrl));
      if (!res.ok) throw new Error(`抓取图片失败：${res.status} ${fetchUrl}`);
      dlog(options, 'fetch ok', { status: res.status, ms: Math.round(nowMs() - fetchStart) });
      const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
      dlog(options, 'content-type =', contentType);
      const buf = await res.arrayBuffer();
      dlog(options, 'arrayBuffer.byteLength =', buf.byteLength);
      const b64 = arrayBufferToBase64(buf);
      dlog(options, 'base64.length =', b64.length);
      cache.set(fetchUrl, `data:${contentType};base64,${b64}`);
    }

    const dataUrl = cache.get(fetchUrl)!;
    out = replaceUrl(out, originalUrl, dataUrl);
    dlog(options, 'replaced -> data url prefix =', dataUrl.slice(0, 48));

    done += 1;
    options.onProgress?.(done, total);
  }

  dlog(options, 'inlineSvgExternalImages:done', {
    images: refs.length,
    ms: Math.round(nowMs() - start),
    outLength: out.length,
  });
  return out;
}

export async function embedSvgExternalImagesAsObjectUrls(
  svgText: string,
  options: {
    maxCount: number;
    concurrency: number;
    baseUrl?: string;
    debug?: boolean;
    debugTag?: string;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<{ svgText: string; objectUrls: string[]; revoke: () => void }> {
  const start = nowMs();
  dgroup(options, 'embedSvgExternalImagesAsObjectUrls:start', () => {
    dlog(options, 'svgText.length =', svgText.length);
    dlog(options, 'baseUrl =', options.baseUrl);
    dlog(options, 'concurrency =', options.concurrency);
    try {
      dlog(options, 'document.baseURI =', typeof document !== 'undefined' ? document.baseURI : '(no document)');
    } catch {}
    try {
      dlog(options, 'location.href =', typeof window !== 'undefined' ? window.location.href : '(no window)');
    } catch {}
      const imageTagCount = (svgText.match(/<image\b/gi) ?? []).length;
      dlog(options, '<image> tags =', imageTagCount);
      const imageTags = svgText.match(/<image\b[^>]*>/gi) ?? [];
      dlog(options, '<image> tag samples =', imageTags.slice(0, 20));
    const unquotedHref = svgText.match(/\\b(?:href|xlink:href)\\s*=\\s*[^\"'\\s>]+/gi) ?? [];
    dlog(options, 'unquoted href samples =', unquotedHref.slice(0, 20));
    const urlMatches = svgText.match(/url\\(([^)]+)\\)/gi);
    dlog(options, 'CSS url(...) matches =', urlMatches?.length ?? 0, urlMatches?.slice(0, 20));
  });
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('当前环境不支持 URL.createObjectURL');
  }

  const refs = collectExternalSvgImages(svgText, options.baseUrl);
  dlog(options, 'collected refs =', refs);
  if (refs.length === 0) return { svgText, objectUrls: [], revoke: () => {} };
  if (refs.length > options.maxCount) {
    throw new Error(`SVG 外链图片过多（${refs.length}），请降低 N 或改用分页导出。`);
  }

  const concurrency = Math.max(1, Math.min(16, Math.floor(options.concurrency)));

  const objectUrls: string[] = [];
  const blobByFetchUrl = new Map<string, string>(); // fetchUrl -> blobUrl
  const blobByOriginalUrl = new Map<string, string>(); // originalUrl -> blobUrl

  let done = 0;
  const total = refs.length;

  const revoke = () => {
    dlog(options, 'revoke object urls', { count: objectUrls.length });
    for (const u of objectUrls) {
      try {
        URL.revokeObjectURL(u);
      } catch {}
    }
  };

  const replaceAll = (input: string, from: string, to: string) =>
    input.replace(
      new RegExp(`(\\b(?:href|xlink:href)\\s*=\\s*["'])${escapeRegExp(from)}(["'])`, 'g'),
      `$1${to}$2`,
    );

  // 简单并发池
  const queue = refs.slice();
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const ref = queue.shift();
      if (!ref) return;
      const { originalUrl, fetchUrl } = ref;
      if (blobByOriginalUrl.has(originalUrl)) {
        done += 1;
        options.onProgress?.(done, total);
        continue;
      }

      if (!blobByFetchUrl.has(fetchUrl)) {
        dgroup(options, `embed:image:${originalUrl}`, () => {
          dlog(options, 'fetchUrl =', fetchUrl);
          dlog(options, 'fetchInit =', getFetchInitForUrl(fetchUrl));
        });

        const fetchStart = nowMs();
        const res = await fetch(fetchUrl, getFetchInitForUrl(fetchUrl));
        if (!res.ok) throw new Error(`抓取图片失败：${res.status} ${fetchUrl}`);
        dlog(options, 'fetch ok', { status: res.status, ms: Math.round(nowMs() - fetchStart) });
        const blob = await res.blob();
        dlog(options, 'blob.size/type =', { size: blob.size, type: blob.type });
        const objUrl = URL.createObjectURL(blob);
        objectUrls.push(objUrl);
        blobByFetchUrl.set(fetchUrl, objUrl);
      }

      blobByOriginalUrl.set(originalUrl, blobByFetchUrl.get(fetchUrl)!);

      done += 1;
      options.onProgress?.(done, total);
    }
  });

  try {
    await Promise.all(workers);
    let out = svgText;

    // 关键：按 URL 长度降序排列，优先替换长 URL。
    // 并发 fetch 完成顺序不确定，若直接遍历 Map，可能先替换短 URL 导致长 URL 被破坏。
    const replacements = Array.from(blobByOriginalUrl.entries()).sort(
      (a, b) => b[0].length - a[0].length,
    );

    for (const [from, to] of replacements) {
      out = replaceAll(out, from, to);
    }
    dlog(options, 'embedSvgExternalImagesAsObjectUrls:done', {
      images: refs.length,
      ms: Math.round(nowMs() - start),
      outLength: out.length,
    });
    return { svgText: out, objectUrls: objectUrls.slice(), revoke };
  } catch (e) {
    revoke();
    throw e;
  }
}

async function preloadObjectUrls(
  urls: string[],
  options: { debug?: boolean; debugTag?: string } | undefined,
  concurrency: number,
): Promise<void> {
  if (typeof Image === 'undefined') {
    dlog(options, 'preloadObjectUrls:skip (no Image)');
    return;
  }
  if (!urls.length) return;

  const limit = Math.max(1, Math.min(12, Math.floor(concurrency)));
  const queue = urls.slice();

  const loadOne = async (url: string): Promise<void> => {
    const start = nowMs();
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      try {
        img.decoding = 'async';
      } catch {}
      img.onload = async () => {
        try {
          // 对部分浏览器：decode 可能比 onload 更能保证可绘制
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const anyImg = img as any;
          if (typeof anyImg.decode === 'function') {
            await anyImg.decode();
          }
        } catch {}
        resolve();
      };
      img.onerror = () => reject(new Error(`preload failed: ${url}`));
      img.src = url;
    });
    dlog(options, 'preload ok', { url, ms: Math.round(nowMs() - start) });
  };

  const workers = Array.from({ length: limit }, async () => {
    while (queue.length) {
      const u = queue.shift();
      if (!u) return;
      try {
        await loadOne(u);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        dlog(options, 'preload failed', { url: u, message });
        // 预加载失败不阻塞导出，继续后续流程
      }
    }
  });

  dlog(options, 'preloadObjectUrls:start', { count: urls.length, concurrency: limit });
  await Promise.all(workers);
  dlog(options, 'preloadObjectUrls:done');
}

export function parseSvgDimensions(svgText: string): { width: number; height: number } | null {
  const svgTagMatch = svgText.match(/<svg\b[^>]*>/i);
  if (!svgTagMatch) return null;

  const svgTag = svgTagMatch[0];

  const parseSvgLength = (raw: string | undefined): number => {
    if (!raw) return Number.NaN;
    const v = raw.trim();
    // 百分比在 SVG 里属于相对单位，无法直接映射到像素；这里回退到 viewBox
    if (/%$/.test(v)) return Number.NaN;
    // 允许纯数字或带 px 的场景（parseFloat 会正确解析）
    const n = Number.parseFloat(v);
    if (!Number.isFinite(n)) return Number.NaN;
    return n;
  };

  const widthMatch = svgTag.match(/\bwidth\s*=\s*["']([^"']+)["']/i);
  const heightMatch = svgTag.match(/\bheight\s*=\s*["']([^"']+)["']/i);
  const viewBoxMatch = svgTag.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);

  const width = parseSvgLength(widthMatch?.[1]);
  const height = parseSvgLength(heightMatch?.[1]);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width, height };
  }

  if (viewBoxMatch) {
    const parts = viewBoxMatch[1]
      .trim()
      .split(/[\s,]+/)
      .map((v) => Number.parseFloat(v));
    if (parts.length === 4 && parts.every((v) => Number.isFinite(v))) {
      const vbWidth = parts[2];
      const vbHeight = parts[3];
      if (vbWidth > 0 && vbHeight > 0) return { width: vbWidth, height: vbHeight };
    }
  }

  return null;
}

const DEFAULT_FONTS = [
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Roboto',
  'Helvetica Neue',
  'Arial',
  'Noto Sans',
  'sans-serif',
];

export class SVGRenderer {
  private static async loadFonts(): Promise<void> {
    if (typeof document === 'undefined' || !document.fonts) {
      return;
    }

    const fontPromises = DEFAULT_FONTS.map(async (font) => {
      try {
        await document.fonts.load(`16px ${font}`);
      } catch (error) {
        console.warn(`Failed to load font ${font}:`, error);
      }
    });

    await Promise.allSettled(fontPromises);
  }

  static async renderToImage(
    svgText: string,
    options: RenderOptions = {},
    onProgress?: (progress: RenderProgress) => void
  ): Promise<Blob> {
    const {
      format = 'png',
      quality = 0.95,
      scale = 2,
      backgroundColor,
      baseUrl,
      debug = false,
      debugTag = 'SVGRenderer',
      waitBeforeDrawMs = 0,
      fontPackId,
      fontFamily,
      embedFonts,
      embedFontMaxFiles = 200,
      inlineImages = false,
      inlineImageMaxCount = 300,
      embedImages = 'data',
      embedImageConcurrency = 50,
      embedImageMaxCount = 500,
    } = options;

    const effectiveEmbedFonts = embedFonts ?? (fontPackId ? 'data' : 'none');

    const debugOptions = { debug, debugTag };
    const start = nowMs();
    dgroup(debugOptions, 'renderToImage:start', () => {
      dlog(debugOptions, 'options', {
        format,
        quality,
        scale,
        backgroundColor,
        baseUrl,
        waitBeforeDrawMs,
        embedFonts: effectiveEmbedFonts,
        embedFontMaxFiles,
        inlineImages,
        inlineImageMaxCount,
        embedImages,
        embedImageConcurrency,
        embedImageMaxCount,
      });
      dlog(debugOptions, 'svgText.length =', svgText.length);
      try {
        dlog(debugOptions, 'document.baseURI =', typeof document !== 'undefined' ? document.baseURI : '(no document)');
      } catch {}
      try {
        dlog(debugOptions, 'location.href =', typeof window !== 'undefined' ? window.location.href : '(no window)');
      } catch {}
      const imageTagCount = (svgText.match(/<image\b/gi) ?? []).length;
      dlog(debugOptions, '<image> tags =', imageTagCount);
      const imageTags = svgText.match(/<image\b[^>]*>/gi) ?? [];
      dlog(debugOptions, '<image> tag samples =', imageTags.slice(0, 20));
      const unquotedHref = svgText.match(/\\b(?:href|xlink:href)\\s*=\\s*[^\"'\\s>]+/gi) ?? [];
      dlog(debugOptions, 'unquoted href samples =', unquotedHref.slice(0, 20));
      const urlMatches = svgText.match(/url\\(([^)]+)\\)/gi);
      dlog(debugOptions, 'CSS url(...) matches =', urlMatches?.length ?? 0, urlMatches?.slice(0, 20));
    });

    onProgress?.({ stage: 'loading-fonts', progress: 0 });
    await this.loadFonts();

    let exportFontFamily: string | undefined;
    if (fontPackId) {
      const injected = await ensureFontPackInjectedToDocument(fontPackId, baseUrl, debugOptions);
      exportFontFamily = fontFamily ?? injected.family;
      await preloadDocumentFont(exportFontFamily, collectSvgTextSample(svgText), debugOptions);
    }

    const sanitized = sanitizeSvgXmlText(svgText);
    if (sanitized.fixed > 0) {
      dlog(debugOptions, 'sanitized invalid xml entities', { fixed: sanitized.fixed });
    }

    let normalizedSvgText = sanitized.text;
    // 兼容：旧参数 inlineImages 默认走 data 内联
    const effectiveEmbed = inlineImages ? 'data' : embedImages;
    dlog(debugOptions, 'effectiveEmbed =', effectiveEmbed);

    if (effectiveEmbed === 'data') {
      onProgress?.({ stage: 'fetching-images', progress: 10 });
      normalizedSvgText = await inlineSvgExternalImages(normalizedSvgText, {
        maxCount: inlineImages ? inlineImageMaxCount : embedImageMaxCount,
        baseUrl,
        concurrency: embedImageConcurrency,
        debug,
        debugTag,
        onProgress: (done, total) => {
          const p = 10 + Math.round((done / Math.max(1, total)) * 35);
          onProgress?.({ stage: 'fetching-images', progress: Math.min(45, p) });
        },
      });

      // 关键：SVG <img> 的 onload 并不保证子 <image> 已完成解码（尤其是数量很多时）。
      // 这里主动预解码 data:/blob: 图片，显著降低“随机缺曲绘”的概率。
      await preloadObjectUrls(collectSvgImageUrlsForPreload(normalizedSvgText), debugOptions, embedImageConcurrency);
    } else if (effectiveEmbed === 'object') {
      onProgress?.({ stage: 'fetching-images', progress: 10 });
      const embedded = await embedSvgExternalImagesAsObjectUrls(normalizedSvgText, {
        maxCount: embedImageMaxCount,
        concurrency: embedImageConcurrency,
        baseUrl,
        debug,
        debugTag,
        onProgress: (done, total) => {
          const p = 10 + Math.round((done / Math.max(1, total)) * 35);
          onProgress?.({ stage: 'fetching-images', progress: Math.min(45, p) });
        },
      });
      normalizedSvgText = embedded.svgText;

      // 关键：外链图若被替换为 blob: URL，部分浏览器会在主 SVG onload 后子资源仍未就绪，导致导出缺图。
      // 这里主动预解码这些 blob: 图片，以提高首次导出的稳定性。
      await preloadObjectUrls(embedded.objectUrls, debugOptions, embedImageConcurrency);

      // 将 revoke 绑定到当前渲染周期：在渲染完成后释放 object URL
      // eslint-disable-next-line no-var
      var revokeObjectUrls: (() => void) | null = embedded.revoke;
    }

    onProgress?.({ stage: 'rendering', progress: 30 });

    if (fontPackId && effectiveEmbedFonts === 'data') {
      try {
        const embedded = await buildEmbeddedFontCssForSvg(svgText, fontPackId, baseUrl, debugOptions, embedFontMaxFiles);
        if (embedded.embeddedFiles > 0 && embedded.css) {
          normalizedSvgText = injectSvgStyle(normalizedSvgText, embedded.css);
          dlog(debugOptions, 'fontPack embedded into svg', { files: embedded.embeddedFiles });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        dlog(debugOptions, 'fontPack embed failed (ignored)', { message });
      }
    }

    if (exportFontFamily) {
      const family = cssStringLiteral(exportFontFamily);
      normalizedSvgText = injectSvgStyle(
        normalizedSvgText,
        `svg, text, tspan { font-family: "${family}", sans-serif !important; }`,
      );
      dlog(debugOptions, 'font override injected', { exportFontFamily });
    }

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(normalizedSvgText, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;

    const parserError = svgElement.querySelector('parsererror');
    if (parserError) {
      throw new Error('Invalid SVG: ' + parserError.textContent);
    }

    const parsedDimensions = parseSvgDimensions(svgText);
    const width = parsedDimensions?.width ?? parseFloat(svgElement.getAttribute('width') || '800');
    const height = parsedDimensions?.height ?? parseFloat(svgElement.getAttribute('height') || '600');
    dlog(debugOptions, 'dimensions', { parsedDimensions, width, height, canvasScale: scale });

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    dlog(debugOptions, 'canvas', { width: canvas.width, height: canvas.height });

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.scale(scale, scale);

    if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }

    const patchedSvgText = injectSvgImageCrossOrigin(normalizedSvgText);
    dlog(debugOptions, 'patchedSvgText.length =', patchedSvgText.length);
    const blob = new Blob([patchedSvgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    dlog(debugOptions, 'svg blob url =', url);

    try {
      const img = new Image();
      // 作为 SVG 渲染到 canvas 的兜底：在部分浏览器中可避免被视为“带凭证的跨域资源”
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.width = width;
      img.height = height;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load SVG image'));
        img.src = url;
      });
      dlog(debugOptions, 'svg image loaded', { ms: Math.round(nowMs() - start) });

      try {
        // 尽量等待主 SVG 完成解码（部分浏览器 decode 能更稳定地等到子资源可绘制）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyImg = img as any;
        if (typeof anyImg.decode === 'function') {
          await anyImg.decode();
          dlog(debugOptions, 'svg image decoded');
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        dlog(debugOptions, 'svg image decode failed', { message });
      }

      try {
        // 再等一帧，让浏览器把 SVG 子资源合成完毕（避免偶发缺图）
        if (typeof requestAnimationFrame === 'function') {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          dlog(debugOptions, 'post-load raf x2');
        }
      } catch {}

      if (waitBeforeDrawMs > 0) {
        dlog(debugOptions, 'waitBeforeDraw:start', { waitBeforeDrawMs });
        await new Promise<void>((resolve) => setTimeout(resolve, waitBeforeDrawMs));
        dlog(debugOptions, 'waitBeforeDraw:done', { waitedMs: waitBeforeDrawMs });
      }

      onProgress?.({ stage: 'rendering', progress: 60 });

      ctx.drawImage(img, 0, 0, width, height);

      onProgress?.({ stage: 'encoding', progress: 80 });

      const mimeType = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
      const resultBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to convert canvas to blob'));
            }
          },
          mimeType,
          quality
        );
      });

      onProgress?.({ stage: 'complete', progress: 100 });

      dlog(debugOptions, 'renderToImage:done', {
        mimeType,
        resultSize: resultBlob.size,
        ms: Math.round(nowMs() - start),
      });
      return resultBlob;
    } finally {
      URL.revokeObjectURL(url);
      try {
        // @ts-expect-error - revokeObjectUrls 仅在 embedImages='object' 场景存在
        if (typeof revokeObjectUrls === 'function') revokeObjectUrls();
      } catch {}
    }
  }

  static async downloadImage(
    svgText: string,
    filename: string,
    options?: RenderOptions,
    onProgress?: (progress: RenderProgress) => void
  ): Promise<void> {
    const blob = await this.renderToImage(svgText, options, onProgress);
    const url = URL.createObjectURL(blob);

    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
