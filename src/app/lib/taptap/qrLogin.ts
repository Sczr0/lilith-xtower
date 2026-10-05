import { TapTapVersion } from '../types/auth';

/**
 * TapTap 扫码登录客户端 —— 对齐后端 2 端点契约：
 *   POST /api/auth/qrcode?taptapVersion=cn|global  → { qrId, verificationUrl, expiresIn, interval }
 *   GET  /api/auth/qrcode/{qrId}/status            → { status, sessionToken?, retryAfter?, message? }
 *
 * 海外（非 CN）由边缘 Worker（Durable Object）处理；国内由源站 catch-all 转 seekend。
 * 对客户端而言同源、同契约，不感知地域。
 */

const BASE = '/api/auth/qrcode';
/** 轮询期间允许的连续瞬时失败上限（上游 5xx/超时），超过则终止。 */
const MAX_CONSECUTIVE_ERRORS = 5;
const MAX_POLL_INTERVAL_MS = 8_000;
const DEFAULT_INTERVAL_MS = 1_000;
const DEFAULT_EXPIRES_SECS = 300;

export type QrCodeData = {
  qrId: string;
  verificationUrl: string;
  /** 二维码要编码的内容（= verificationUrl）。 */
  qrcodeUrl: string;
  interval: number;
  expiresIn: number;
};

type CreateResponse = { qrId: string; verificationUrl: string; expiresIn?: number; interval?: number };
type StatusValue = 'Pending' | 'Scanned' | 'Confirmed' | 'Error' | 'Expired';
type StatusResponse = {
  status: StatusValue;
  sessionToken?: string;
  retryAfter?: number;
  message?: string;
  errorCode?: string;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 从错误体里提取人类可读文案（兼容 ProblemDetails 的 detail/message/title 与 {error}/{msg}）。 */
function extractFriendlyError(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      for (const key of ['detail', 'message', 'error', 'msg', 'title']) {
        const candidate = parsed?.[key];
        if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
      }
      return '';
    } catch {
      return '';
    }
  }
  return trimmed;
}

async function requestJson<T>(path: string, init: RequestInit, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { ...init, signal });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(extractFriendlyError(text) || `请求失败: ${res.status}`);
  }
  return (await res.json()) as T;
}

/** 申请二维码（服务端申请设备码并缓存待授权流程）。 */
export async function requestTapTapDeviceCode(
  version: TapTapVersion,
  signal?: AbortSignal,
): Promise<QrCodeData> {
  const data = await requestJson<CreateResponse>(
    `${BASE}?taptapVersion=${encodeURIComponent(version)}`,
    { method: 'POST' },
    signal,
  );
  if (!data?.qrId || !data?.verificationUrl) {
    throw new Error('获取二维码失败');
  }
  return {
    qrId: data.qrId,
    verificationUrl: data.verificationUrl,
    qrcodeUrl: data.verificationUrl,
    interval: data.interval && data.interval > 0 ? data.interval : DEFAULT_INTERVAL_MS / 1000,
    expiresIn: data.expiresIn && data.expiresIn > 0 ? data.expiresIn : DEFAULT_EXPIRES_SECS,
  };
}

/**
 * 轮询授权状态；`Confirmed` 时返回 LeanCloud sessionToken。
 * - `Error`(UNAUTHORIZED 等) / `Expired` → 直接抛错；
 * - `Error`(UPSTREAM_ERROR/UPSTREAM_TIMEOUT) → 退避重试，超过上限才抛错。
 */
export async function pollTapTapSessionToken(
  qrId: string,
  intervalMs: number,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<string> {
  const start = Date.now();
  let interval = intervalMs > 0 ? intervalMs : DEFAULT_INTERVAL_MS;
  let consecutiveErrors = 0;

  while (true) {
    if (signal?.aborted) throw new DOMException('轮询已取消', 'AbortError');

    const res = await requestJson<StatusResponse>(
      `${BASE}/${encodeURIComponent(qrId)}/status`,
      { method: 'GET' },
      signal,
    );

    if (res.status === 'Confirmed') {
      if (!res.sessionToken) throw new Error('登录未返回会话令牌');
      return res.sessionToken;
    }
    if (res.status === 'Expired') {
      throw new Error(res.message || '二维码已过期，请重新获取');
    }
    if (res.status === 'Error') {
      const transient = res.errorCode === 'UPSTREAM_ERROR' || res.errorCode === 'UPSTREAM_TIMEOUT';
      if (!transient) throw new Error(res.message || '登录失败，请重试');
      consecutiveErrors += 1;
      if (consecutiveErrors > MAX_CONSECUTIVE_ERRORS) {
        throw new Error(res.message || '网络异常，请重新获取二维码');
      }
      interval = Math.min(interval * 2, MAX_POLL_INTERVAL_MS);
    } else {
      // Pending / Scanned：恢复正常节奏，按服务端建议的 retryAfter 走
      consecutiveErrors = 0;
      interval = res.retryAfter && res.retryAfter > 0 ? res.retryAfter * 1000 : interval;
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error('扫描超时，请重新获取二维码');
    }
    await sleep(interval);
  }
}
