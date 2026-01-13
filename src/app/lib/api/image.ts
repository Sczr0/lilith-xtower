

// 说明：客户端使用同源 /api，由服务端会话代理注入鉴权信息（P0-1）。
const BASE_URL = '/api';
const DEFAULT_TIMEOUT_MS = 30000;

export type BestNTheme = 'dark' | 'white';
export type ImageFormat = 'png' | 'svg';

export class ImageAPI {
  static async generateBestNImage(
    n: number,
    theme: BestNTheme = 'dark',
    format: ImageFormat = 'png',
  ): Promise<Blob> {
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error('N 值必须为正整数');
    }

    const body = {
      n,
      // 后端主题：white/black；兼容前端枚举
      theme: theme === 'white' ? 'white' : 'black',
    };

    // 后端图片格式使用 Query Param 传递，便于缓存系统区分不同输出
    const query = new URLSearchParams();
    query.set('format', format);
    const url = `${BASE_URL}/image/bn?${query.toString()}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    const response = await fetch(url, {
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

  static async generateBestNSVG(
    n: number,
    theme: BestNTheme = 'dark',
  ): Promise<string> {
    const blob = await ImageAPI.generateBestNImage(n, theme, 'svg');
    return blob.text();
  }

  static async generateSongImage(
    songQuery: string,
  ): Promise<Blob> {
    if (!songQuery.trim()) {
      throw new Error('歌曲关键词不能为空');
    }

    const body = {
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
