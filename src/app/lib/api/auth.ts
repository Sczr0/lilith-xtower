import { 
  QRCodeResponse, 
  QRCodeStatusResponse, 
  AuthRequest,
  AuthCredential 
} from '../types/auth';

const BASE_URL = '/api';

/**
 * API调用工具类
 * 处理所有与认证相关的后端API调用
 */
export class AuthAPI {
  /**
   * 获取登录二维码
   */
  static async getQRCode(): Promise<QRCodeResponse> {
    try {
      const response = await fetch(`${BASE_URL}/auth/qrcode`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('获取二维码失败');
      }

      return await response.json();
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

      return await response.json();
    } catch (error) {
      console.error('查询扫码状态失败:', error);
      throw error instanceof Error ? error : new Error('网络错误，请检查网络连接');
    }
  }

  /**
   * 验证登录凭证有效性
   */
  static async validateCredential(credential: AuthCredential): Promise<boolean> {
    try {
      let requestBody: AuthRequest;

      switch (credential.type) {
        case 'session':
          requestBody = { token: credential.token };
          break;
        case 'api':
          requestBody = {
            data_source: 'external',
            api_user_id: credential.api_user_id,
            ...(credential.api_token && { api_token: credential.api_token })
          };
          break;
        case 'platform':
          requestBody = {
            data_source: 'external',
            platform: credential.platform,
            platform_id: credential.platform_id
          };
          break;
        default:
          throw new Error('不支持的凭证类型');
      }

      const response = await fetch(`${BASE_URL}/get/cloud/saves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // 如果返回200，说明凭证有效
      return response.ok;
    } catch (error) {
      console.error('验证凭证失败:', error);
      return false;
    }
  }

  /**
   * 获取用户云存档数据（用于验证凭证和获取用户信息）
   */
  static async getCloudSaves(credential: AuthCredential): Promise<any> {
    try {
      let requestBody: AuthRequest;

      switch (credential.type) {
        case 'session':
          requestBody = { token: credential.token };
          break;
        case 'api':
          requestBody = {
            data_source: 'external',
            api_user_id: credential.api_user_id,
            ...(credential.api_token && { api_token: credential.api_token })
          };
          break;
        case 'platform':
          requestBody = {
            data_source: 'external',
            platform: credential.platform,
            platform_id: credential.platform_id
          };
          break;
        default:
          throw new Error('不支持的凭证类型');
      }

      const response = await fetch(`${BASE_URL}/get/cloud/saves`, {
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
      return data;
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