import { AuthCredential } from '../types/auth';
import { RksResponse, ServiceStatsResponse } from '../types/score';
import { buildAuthRequestBody } from './auth';

const BASE_URL = '/api';

export class ScoreAPI {
  static async getRksList(credential: AuthCredential): Promise<RksResponse> {
    const requestBody = buildAuthRequestBody(credential);

    const response = await fetch(`${BASE_URL}/rks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let message = '获取 RKS 列表失败';
      try {
        const data = await response.json();
        if (data?.message) {
          message = data.message;
        }
      } catch (error) {
        console.error('解析 RKS 列表错误信息失败:', error);
      }
      throw new Error(message);
    }

    return response.json();
  }

  static async getServiceStats(): Promise<ServiceStatsResponse> {
    const response = await fetch(`${BASE_URL}/image/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('获取服务统计失败');
    }

    return response.json();
  }
}
