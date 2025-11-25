import {
  QRCodeResponse,
  QRCodeStatusResponse,
  AuthRequest,
  AuthCredential,
} from '../types/auth';
import { AuthStorage } from '../storage/auth';

const BASE_URL = '/api';

export const buildAuthRequestBody = (credential: AuthCredential): AuthRequest => {
  const taptapVersion = AuthStorage.getTapTapVersion();
  switch (credential.type) {
    case 'session':
      return { 
        sessionToken: credential.token,
        taptap_version: taptapVersion
      };
    case 'api':
      return {
        externalCredentials: {
          apiUserId: credential.api_user_id,
          apiToken: credential.api_token ?? null,
        },
        taptap_version: taptapVersion
      };
    case 'platform':
      return {
        externalCredentials: {
          platform: credential.platform,
          platformId: credential.platform_id,
        },
        taptap_version: taptapVersion
      };
    default:
      throw new Error('不支持的凭证类型');
  }
};

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
   */
  static async getQRCode(): Promise<QRCodeResponse> {
    try {
      const taptapVersion = AuthStorage.getTapTapVersion();
      const response = await fetch(`${BASE_URL}/auth/qrcode?taptap_version=${taptapVersion}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('获取二维码失败');
      }

      const data = await response.json();
      // 适配：后端返回 { qr_id, qrcode_base64, verification_url }
      const mapped: QRCodeResponse = {
        qrId: data.qr_id,
        qrCodeImage: data.qrcode_base64,
        qrcodeUrl: data.verification_url,
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

  /**
   * 验证登录凭证有效性
   * @returns { isValid: boolean, shouldLogout: boolean, error?: string }
   * - isValid: 凭证是否有效
   * - shouldLogout: 是否应该退出登录（清除凭证）
   * - error: 错误信息
   */
  static async validateCredential(credential: AuthCredential): Promise<{
    isValid: boolean;
    shouldLogout: boolean;
    error?: string;
  }> {
    try {
      const requestBody = buildAuthRequestBody(credential);

      const response = await fetch(`${BASE_URL}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // 如果返回200，说明凭证有效
      if (response.ok) {
        return { isValid: true, shouldLogout: false };
      }

      // 4xx 错误：凭证问题，应该退出登录
      if (response.status >= 400 && response.status < 500) {
        return {
          isValid: false,
          shouldLogout: true,
          error: '登录凭证已过期或无效，请重新登录'
        };
      }

      // 5xx 错误：服务器问题，保留凭证
      if (response.status >= 500) {
        return {
          isValid: false,
          shouldLogout: false,
          error: '服务器暂时无法访问，请稍后再试'
        };
      }

      // 其他错误
      return {
        isValid: false,
        shouldLogout: false,
        error: '网络错误，请检查网络连接'
      };
    } catch (error) {
      console.error('验证凭证失败:', error);
      // 网络错误不应该清除凭证
      return {
        isValid: false,
        shouldLogout: false,
        error: '网络错误，请检查网络连接'
      };
    }
  }

  /**
   * 获取用户云存档数据（用于验证凭证和获取用户信息）
   */
  static async getCloudSaves(credential: AuthCredential): Promise<unknown> {
    try {
      const requestBody = buildAuthRequestBody(credential);

      const response = await fetch(`${BASE_URL}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 400) {
          throw new Error('登录凭证无效或已过期');
        }
        throw new Error('获取用户数据失败');
      }

      const data = await response.json();
      return data as unknown;
    } catch (error) {
      console.error('获取用户数据失败:', error);
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
