import {
  QRCodeResponse,
  QRCodeStatusResponse,
} from '../types/auth';
import { AuthStorage } from '../storage/auth';

const BASE_URL = '/api';

/**
 * API调用工具类
 * 处理所有与认证相关的后端API调用
 */
export class AuthAPI {
  /**
   * 轻量健康检查：用于站点访问时的存活性校验，避免触发 /save 的重负载逻辑。
   */
  static async checkHealth(): Promise<boolean> {
    try {
      // 通过应用自身域名访问相对路径，避免跨域与硬编码
      const res = await fetch('/health', {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
      });
      // 放宽判断：任何 2xx 视为可用，避免因返回体格式变化误判
      if (res.ok) return true;
      return false;
    } catch {
      return false;
    }
  }
  /**
   * 获取登录二维码
   * - 新版 API：POST /auth/qrcode?taptapVersion=cn|global
   * - 响应：{ qrId, qrcodeBase64, verificationUrl }
   */
  static async getQRCode(): Promise<QRCodeResponse> {
    try {
      const taptapVersion = AuthStorage.getTapTapVersion();
      const query = new URLSearchParams();
      if (taptapVersion) query.set('taptapVersion', taptapVersion);
      const url = `${BASE_URL}/auth/qrcode${query.toString() ? `?${query.toString()}` : ''}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('获取二维码失败');
      }

      const data = await response.json();
      // 适配：后端返回 { qrId, qrcodeBase64, verificationUrl }
      const mapped: QRCodeResponse = {
        qrId: data.qrId,
        qrCodeImage: data.qrcodeBase64,
        qrcodeUrl: data.verificationUrl,
      };
      return mapped;
    } catch (error) {
      console.error('获取二维码失败:', error);
      throw new Error('网络错误，请检查网络连接');
    }
  }

  /**
   * 查询二维码扫码状态
   */
  static async pollQRStatus(qrId: string): Promise<QRCodeStatusResponse> {
    try {
      const response = await fetch(`${BASE_URL}/auth/qrcode/${qrId}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('二维码已过期，请重新获取');
        }
        throw new Error('查询扫码状态失败');
      }

      const data = await response.json();
      // 适配：后端 status: Pending/Scanned/Confirmed/Error/Expired
      let status: QRCodeStatusResponse['status'] = 'scanning';
      if (data.status === 'Confirmed') status = 'success';
      else if (data.status === 'Expired' || data.status === 'Error') status = 'expired';
      else status = 'scanning';
      return { status, sessionToken: data.sessionToken };
    } catch (error) {
      console.error('查询扫码状态失败:', error);
      throw error instanceof Error ? error : new Error('网络错误，请检查网络连接');
    }
  }
}

/**
 * 通用的轮询函数
 */
export const poll = async <T>(
  fn: () => Promise<T>,
  validate: (result: T) => boolean,
  interval: number = 2000,
  timeout: number = 120000 // 2分钟超时
): Promise<T> => {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const executePoll = async () => {
      try {
        const result = await fn();
        
        if (validate(result)) {
          resolve(result);
          return;
        }

        if (Date.now() - startTime >= timeout) {
          reject(new Error('轮询超时'));
          return;
        }

        setTimeout(executePoll, interval);
      } catch (error) {
        reject(error);
      }
    };

    executePoll();
  });
};
