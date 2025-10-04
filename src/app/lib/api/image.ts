import { AuthCredential } from '../types/auth';
import { buildAuthRequestBody } from './auth';

const BASE_URL = '/api';

export type BestNTheme = 'dark' | 'white';

export class ImageAPI {
  static async generateBestNImage(
    n: number,
    credential: AuthCredential,
    theme: BestNTheme = 'dark'
  ): Promise<Blob> {
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error('N 值必须为正整数');
    }

    const requestBody = buildAuthRequestBody(credential);
    const params = new URLSearchParams();

    if (theme === 'white') {
      params.set('theme', 'white');
    }

    const query = params.toString();
    const response = await fetch(`${BASE_URL}/image/bn/${n}${query ? `?${query}` : ''}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

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
