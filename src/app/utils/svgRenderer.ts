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

    const width = parseFloat(svgElement.getAttribute('width') || '800');
    const height = parseFloat(svgElement.getAttribute('height') || '600');

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
