export interface RenderOptions {
  format?: 'png' | 'jpg' | 'webp';
  quality?: number;
  scale?: number;
  backgroundColor?: string;
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

export function injectSvgImageCrossOrigin(svgText: string): string {
  // 将 SVG 内 <image> 的外链资源按 CORS 模式加载，否则 canvas 可能被污染（tainted）导致无法导出。
  // 只对带 http(s) href/xlink:href 且未声明 crossorigin 的 <image> 注入。
  return svgText.replace(/<image\b[^>]*>/gi, (tag) => {
    if (/\bcrossorigin\s*=/i.test(tag)) return tag;
    if (!/\b(?:href|xlink:href)\s*=\s*["']https?:\/\//i.test(tag)) return tag;
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
  url: string;
};

function collectExternalSvgImages(svgText: string): SvgImageRef[] {
  const urls = new Set<string>();
  const regex = /<image\b[^>]*\s(?:href|xlink:href)\s*=\s*(["'])([^"']+)\1[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(svgText))) {
    const url = match[2] ?? '';
    if (/^https?:\/\//i.test(url)) urls.add(url);
  }

  return Array.from(urls).map((url) => ({ url }));
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function inlineSvgExternalImages(
  svgText: string,
  options: { maxCount: number; onProgress?: (done: number, total: number) => void },
): Promise<string> {
  const refs = collectExternalSvgImages(svgText);
  if (refs.length === 0) return svgText;
  if (refs.length > options.maxCount) {
    throw new Error(`SVG 外链图片过多（${refs.length}），请降低 N 或关闭内联导出。`);
  }

  const cache = new Map<string, string>(); // url -> dataURL
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

  let out = svgText;

  for (const { url } of refs) {
    if (!cache.has(url)) {
      const res = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit' });
      if (!res.ok) throw new Error(`抓取图片失败：${res.status} ${url}`);
      const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
      const buf = await res.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      cache.set(url, `data:${contentType};base64,${b64}`);
    }

    const dataUrl = cache.get(url)!;
    out = replaceUrl(out, url, dataUrl);

    done += 1;
    options.onProgress?.(done, total);
  }

  return out;
}

export async function embedSvgExternalImagesAsObjectUrls(
  svgText: string,
  options: {
    maxCount: number;
    concurrency: number;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<{ svgText: string; revoke: () => void }> {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('当前环境不支持 URL.createObjectURL');
  }

  const refs = collectExternalSvgImages(svgText);
  if (refs.length === 0) return { svgText, revoke: () => {} };
  if (refs.length > options.maxCount) {
    throw new Error(`SVG 外链图片过多（${refs.length}），请降低 N 或改用分页导出。`);
  }

  const concurrency = Math.max(1, Math.min(16, Math.floor(options.concurrency)));

  const objectUrls: string[] = [];
  const mapping = new Map<string, string>(); // url -> blobUrl

  let done = 0;
  const total = refs.length;

  const revoke = () => {
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
  const queue = refs.map((r) => r.url);
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const url = queue.shift();
      if (!url) return;
      if (mapping.has(url)) {
        done += 1;
        options.onProgress?.(done, total);
        continue;
      }

      const res = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit' });
      if (!res.ok) throw new Error(`抓取图片失败：${res.status} ${url}`);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      objectUrls.push(objUrl);
      mapping.set(url, objUrl);

      done += 1;
      options.onProgress?.(done, total);
    }
  });

  try {
    await Promise.all(workers);
    let out = svgText;
    for (const [from, to] of mapping.entries()) {
      out = replaceAll(out, from, to);
    }
    return { svgText: out, revoke };
  } catch (e) {
    revoke();
    throw e;
  }
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
      inlineImages = false,
      inlineImageMaxCount = 300,
      embedImages = 'data',
      embedImageConcurrency = 50,
      embedImageMaxCount = 500,
    } = options;

    onProgress?.({ stage: 'loading-fonts', progress: 0 });
    await this.loadFonts();

    let normalizedSvgText = svgText;
    // 兼容：旧参数 inlineImages 默认走 data 内联
    const effectiveEmbed = inlineImages ? 'data' : embedImages;

    if (effectiveEmbed === 'data') {
      onProgress?.({ stage: 'fetching-images', progress: 10 });
      normalizedSvgText = await inlineSvgExternalImages(svgText, {
        maxCount: inlineImages ? inlineImageMaxCount : embedImageMaxCount,
        onProgress: (done, total) => {
          const p = 10 + Math.round((done / Math.max(1, total)) * 35);
          onProgress?.({ stage: 'fetching-images', progress: Math.min(45, p) });
        },
      });
    } else if (effectiveEmbed === 'object') {
      onProgress?.({ stage: 'fetching-images', progress: 10 });
      const embedded = await embedSvgExternalImagesAsObjectUrls(svgText, {
        maxCount: embedImageMaxCount,
        concurrency: embedImageConcurrency,
        onProgress: (done, total) => {
          const p = 10 + Math.round((done / Math.max(1, total)) * 35);
          onProgress?.({ stage: 'fetching-images', progress: Math.min(45, p) });
        },
      });
      normalizedSvgText = embedded.svgText;

      // 将 revoke 绑定到当前渲染周期：在渲染完成后释放 object URL
      // eslint-disable-next-line no-var
      var revokeObjectUrls: (() => void) | null = embedded.revoke;
    }

    onProgress?.({ stage: 'rendering', progress: 30 });

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

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

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
    const blob = new Blob([patchedSvgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

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
