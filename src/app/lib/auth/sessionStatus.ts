import type { SessionStatusResponse } from './credentialSummary';

/**
 * 会话状态查询客户端。
 *
 * 背景（P0-2）：/api/session 抽风或超时不应被当作「未登录」。
 * 这里统一承担三件事，让调用方（AuthContext）只需区分「确定结果」与「暂时查不到」：
 * - 单次请求带超时：服务端慢响应不会让初始化永远停在 loading；
 * - 瞬时失败（网络错误 / 超时 / 5xx）做有限次退避重试；
 * - 4xx（尤其 401）不做重试，直接作为权威判定返回。
 */

export const SESSION_STATUS_TIMEOUT_MS = 5_000;
/** 退避重试间隔：总等待约 1.2s，兼顾「抽风自愈」与「不长时间空转」。 */
export const SESSION_STATUS_RETRY_DELAYS_MS = [400, 800] as const;

type SessionStatusPayload = SessionStatusResponse & { error?: string };

/** 瞬时失败（网络/超时/5xx）：不代表用户未登录，调用方应保留本地登录态。 */
export class SessionStatusTransientError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'SessionStatusTransientError';
    this.status = status;
  }
}

/** 权威失败（4xx）：服务端明确判定未登录或请求非法。 */
export class SessionStatusAuthoritativeError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SessionStatusAuthoritativeError';
    this.status = status;
  }
}

export function isTransientSessionStatusError(value: unknown): value is SessionStatusTransientError {
  return value instanceof SessionStatusTransientError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 单次请求（带超时）。超时以瞬时错误抛出，避免把「慢」误判成「未登录」。
 */
async function requestSessionStatus(timeoutMs: number): Promise<SessionStatusPayload> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let res: Response;
  try {
    res = await fetch('/api/session', {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new SessionStatusTransientError('获取会话状态超时');
    }
    const message = error instanceof Error ? error.message : '网络错误';
    throw new SessionStatusTransientError(message);
  } finally {
    clearTimeout(timer);
  }

  const payload = (await res.json().catch(() => null)) as SessionStatusPayload | null;

  if (res.status >= 400 && res.status < 500) {
    throw new SessionStatusAuthoritativeError(payload?.error || `获取会话失败（${res.status}）`, res.status);
  }

  if (!res.ok || !payload) {
    throw new SessionStatusTransientError(payload?.error || `获取会话失败（${res.status}）`, res.status);
  }

  return payload;
}

export type FetchSessionStatusOptions = {
  timeoutMs?: number;
  retryDelaysMs?: readonly number[];
};

/**
 * 查询会话状态：超时 + 退避重试。
 * 瞬时失败耗尽重试后抛出 SessionStatusTransientError，由调用方决定降级策略。
 */
export async function fetchSessionStatus(
  options: FetchSessionStatusOptions = {},
): Promise<SessionStatusPayload> {
  const timeoutMs = options.timeoutMs ?? SESSION_STATUS_TIMEOUT_MS;
  const retryDelays = options.retryDelaysMs ?? SESSION_STATUS_RETRY_DELAYS_MS;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      return await requestSessionStatus(timeoutMs);
    } catch (error) {
      // 权威判定（4xx）不重试，直接上抛
      if (error instanceof SessionStatusAuthoritativeError) throw error;

      lastError = error;

      const delay = retryDelays[attempt];
      if (delay === undefined) break;
      await sleep(delay);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new SessionStatusTransientError('获取会话状态失败');
}
