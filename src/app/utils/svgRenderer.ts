export interface RenderOptions {
  format?: 'png' | 'jpg' | 'webp';
  quality?: number;
  scale?: number;
  backgroundColor?: string;
}

export interface RenderProgress {
  stage: 'loading-fonts' | 'rendering' | 'encoding' | 'complete';
  progress: number;
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
    } = options;

    onProgress?.({ stage: 'loading-fonts', progress: 0 });
    await this.loadFonts();

    onProgress?.({ stage: 'rendering', progress: 30 });

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
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

    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
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
