import { AuthCredential } from '../types/auth';
import { buildAuthRequestBody } from './auth';

// 在浏览器端使用同源 /api 避免 CORS 预检；仅在服务端允许环境变量覆盖
const BASE_URL: string =
  typeof window !== 'undefined' ? '/api' : (process.env.NEXT_PUBLIC_API as string) ?? '/api';
const DEFAULT_TIMEOUT_MS = 30000;

export type BestNTheme = 'dark' | 'white';
export type ImageFormat = 'png' | 'svg';

export class ImageAPI {
  static async generateBestNImage(
    n: number,
    credential: AuthCredential,
    theme: BestNTheme = 'dark',
    format: ImageFormat = 'png',
  ): Promise<Blob> {
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error('N 值必须为正整数');
    }

    const auth = buildAuthRequestBody(credential);
    const body = {
      ...auth,
      n,
      // 后端主题：white/black；兼容前端枚举
      theme: theme === 'white' ? 'white' : 'black',
      format,
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    const response = await fetch(`${BASE_URL}/image/bn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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

  // 新后端暂不提供 SVG 渲染，保留占位实现以避免调用方崩溃
  static async generateBestNSVG(
    n: number,
    credential: AuthCredential,
    theme: BestNTheme = 'dark',
  ): Promise<string> {
    const blob = await ImageAPI.generateBestNImage(n, credential, theme, 'png');
    // 返回一个 data URL 作为占位
    return URL.createObjectURL(blob);
  }

  static async generateSongImage(
    songQuery: string,
    credential: AuthCredential,
  ): Promise<Blob> {
    if (!songQuery.trim()) {
      throw new Error('歌曲关键词不能为空');
    }

    const auth = buildAuthRequestBody(credential);
    const body = {
      ...auth,
      song: songQuery,
    };

    const response = await fetch(`${BASE_URL}/image/song`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
