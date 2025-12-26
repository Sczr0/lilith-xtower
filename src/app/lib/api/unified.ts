import type {
  UnifiedApiBindRequest,
  UnifiedApiBindResponse,
  UnifiedApiSetApiTokenRequest,
  UnifiedApiSetApiTokenResponse,
  UnifiedApiTokenListRequest,
  UnifiedApiTokenListResponse,
  UnifiedApiUnbindRequest,
  UnifiedApiUnbindResponse,
  UnifiedApiCloudSongRequest,
} from '../types/unified-api';

const BASE_URL = '/api/unified';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const tryParseJson = (text: string): unknown => {
  if (!text) return null;
  try {
    return JSON.parse(text) as Json;
  } catch {
    return text;
  }
};

const extractErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== 'object') return fallback;
  const p = payload as Record<string, unknown>;
  const error = typeof p.error === 'string' ? p.error : undefined;
  const message = typeof p.message === 'string' ? p.message : undefined;
  return error || message || fallback;
};

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, { ...init, cache: 'no-store' });
  const text = await res.text();
  const payload = tryParseJson(text);
  if (!res.ok) {
    const fallback = `请求失败（${res.status}）`;
    throw new Error(extractErrorMessage(payload, fallback));
  }
  return payload as T;
}

/**
 * 联合API调用封装（通过本站后端代理 /api/unified 转发）
 */
export class UnifiedAPI {
  /**
   * 通用请求入口：用于对接文档未封装的接口（仍走 /api/unified 代理）
   */
  static request<T = unknown>(path: string, body?: unknown, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST') {
    const init: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (method !== 'GET') {
      init.body = JSON.stringify(body ?? {});
    }
    return requestJson<T>(path, init);
  }

  static bind(body: UnifiedApiBindRequest) {
    return requestJson<UnifiedApiBindResponse>('/bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  static setApiToken(body: UnifiedApiSetApiTokenRequest) {
    return requestJson<UnifiedApiSetApiTokenResponse>('/setApiToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  static tokenList(body: UnifiedApiTokenListRequest) {
    return requestJson<UnifiedApiTokenListResponse>('/token/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  static unbind(body: UnifiedApiUnbindRequest) {
    return requestJson<UnifiedApiUnbindResponse>('/unbind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  static getCloudSaves(body: Record<string, unknown>) {
    return UnifiedAPI.request('/get/cloud/saves', body);
  }

  static getCloudSaveInfo(body: Record<string, unknown>) {
    return UnifiedAPI.request('/get/cloud/saveInfo', body);
  }

  static getCloudSong(body: UnifiedApiCloudSongRequest) {
    return UnifiedAPI.request('/get/cloud/song', body);
  }
}
