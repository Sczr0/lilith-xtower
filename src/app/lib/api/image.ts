import { AuthCredential } from '../types/auth';
import { buildAuthRequestBody } from './auth';

// In browser use same-origin rewrite "/api" to avoid CORS preflight; allow env on server only
const BASE_URL: string = typeof window !== 'undefined'
  ? '/api'
  : ((process.env.NEXT_PUBLIC_API as string) ?? '/api');
const DEFAULT_TIMEOUT_MS = 30000;

export type BestNTheme = 'dark' | 'white';
export type ImageFormat = 'png' | 'svg';

export class ImageAPI {
  static async generateBestNImage(
    n: number,
    credential: AuthCredential,
    theme: BestNTheme = 'dark',
    format: ImageFormat = 'png'
  ): Promise<Blob> {
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error('N 值必须为正整数');
    }

    const requestBody = buildAuthRequestBody(credential);
    const params = new URLSearchParams();

    if (theme === 'white') {
      params.set('theme', 'white');
    }

    if (format === 'svg') {
      params.set('format', 'svg');
    }

    const query = params.toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    const response = await fetch(`${BASE_URL}/image/bn/${n}${query ? `?${query}` : ''}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      let message = '生成 Best N 图片失败';
      try {
        const data = await response.json();
        if (data?.message) {
          message = data.message;
        }
      } catch (error) {
        console.error('解析 Best N 图片错误信息失败:', error);
      }
      throw new Error(message);
    }

    return response.blob();
  }

  static async generateBestNSVG(
    n: number,
    credential: AuthCredential,
    theme: BestNTheme = 'dark'
  ): Promise<string> {
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error('N 值必须为正整数');
    }

    const requestBody = buildAuthRequestBody(credential);
    const params = new URLSearchParams();

    if (theme === 'white') {
      params.set('theme', 'white');
    }
    params.set('format', 'svg');

    const query = params.toString();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    const response = await fetch(`${BASE_URL}/image/bn/${n}${query ? `?${query}` : ''}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'image/svg+xml,application/json;q=0.9,*/*;q=0.8',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      let message = '生成 Best N 图片失败';
      try {
        const data = await response.json();
        if (data?.message) {
          message = data.message;
        }
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('image/svg')) {
      return response.text();
    }
    // If backend mistakenly returns JSON, surface it for debugging
    if (contentType.includes('application/json')) {
      try {
        const data = await response.json();
        const msg = typeof data === 'string' ? data : (data?.message || JSON.stringify(data));
        throw new Error(msg);
      } catch {
        throw new Error('后端返回了 JSON 而非 SVG');
      }
    }
    // Fallback
    return response.text();
  }

  static async generateSongImage(
    songQuery: string,
    credential: AuthCredential
  ): Promise<Blob> {
    if (!songQuery.trim()) {
      throw new Error('歌曲关键词不能为空');
    }

    const requestBody = buildAuthRequestBody(credential);
    const params = new URLSearchParams();
    params.set('q', songQuery);

    const response = await fetch(`${BASE_URL}/image/song?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let message = '生成单曲图片失败';
      try {
        const data = await response.json();
        if (data?.message) {
          message = data.message;
        }
      } catch (error) {
        console.error('解析单曲图片错误信息失败:', error);
      }
      throw new Error(message);
    }

    return response.blob();
  }
}
