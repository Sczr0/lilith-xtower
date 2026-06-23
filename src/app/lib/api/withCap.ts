/**
 * Cap 验证码集成 — 服务端 token 验证 & 断路降级
 *
 * 说明：
 * - 调用 Cap Standalone 的 /<site_key>/siteverify 接口验证客户端提交的 cap-token
 * - 内置 Circuit Breaker：超时/服务不可用时自动降级通过，避免阻断正常用户
 * - 通过环境变量 CAP_API_BASE + CAP_SITE_KEY + CAP_SECRET_KEY 配置
 */

const CAP_API_BASE =
  (process.env.CAP_API_BASE ?? '').trim() || 'http://127.0.0.1:3001';
const CAP_SITE_KEY =
  (process.env.CAP_SITE_KEY ?? '').trim() || '904b5b0099';
const CAP_VERIFY_URL = `${CAP_API_BASE.replace(/\/+$/, '')}/${CAP_SITE_KEY}/siteverify`;
const CAP_SECRET_KEY = (process.env.CAP_SECRET_KEY ?? '').trim();

const SITEVERIFY_TIMEOUT_MS = 3_000; // 单次验证超时 3 秒

// —— Circuit Breaker (简单实现) ——
type CircuitState = 'closed' | 'open' | 'half-open';

let circuitState: CircuitState = 'closed';
let circuitOpenAt = 0;
let circuitFailureCount = 0;
const CIRCUIT_OPEN_MS = 30_000; // 断路后 30 秒尝试恢复
const CIRCUIT_FAILURE_THRESHOLD = 5; // 连续 5 次失败后断路

function transitionToOpen() {
  circuitState = 'open';
  circuitOpenAt = Date.now();
  circuitFailureCount = 0;
}

function shouldAttemptRecovery(): boolean {
  if (circuitState !== 'open') return false;
  return Date.now() - circuitOpenAt >= CIRCUIT_OPEN_MS;
}

// —— 远端验证 ——
export type CapVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_token' | 'config_missing' | 'circuit_open' | 'upstream_error' | 'timeout' };

/**
 * 验证 Cap token。
 * - token 为空/未配置密钥 → 降级通过（渐进式上线兼容）
 * - 验证成功 → ok
 * - 验证失败/远端不可用 → 根据 circuit breaker 决定是否降级
 */
export async function verifyCapToken(token: string | undefined | null): Promise<CapVerifyResult> {
  // 渐进式灰度上线：未提供 token 或未配置密钥时，不阻断
  if (!token || !CAP_SECRET_KEY) {
    return { ok: true };
  }

  // Circuit breaker 断路期 → 降级通过
  if (circuitState === 'open') {
    if (shouldAttemptRecovery()) {
      circuitState = 'half-open';
    } else {
      return { ok: true }; // 降级通过
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SITEVERIFY_TIMEOUT_MS);

  try {
    const res = await fetch(CAP_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: CAP_SECRET_KEY, response: token }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok) {
      // Cap 明确拒绝了 token
      circuitFailureCount += 1;
      if (circuitState === 'half-open' || circuitFailureCount >= CIRCUIT_FAILURE_THRESHOLD) {
        transitionToOpen();
      }
      return { ok: false, reason: 'invalid_token' };
    }

    const data = (await res.json()) as { success?: boolean };

    // Cap v3 的验证成功标志。注意：siteverify 兼容 reCAPTCHA 格式，但 Cap v3 可能返回 { success: true }
    if (data.success === true) {
      // 验证成功 — 重置断路器
      circuitState = 'closed';
      circuitFailureCount = 0;
      return { ok: true };
    }

    circuitFailureCount += 1;
    if (circuitFailureCount >= CIRCUIT_FAILURE_THRESHOLD) {
      transitionToOpen();
    }
    return { ok: false, reason: 'invalid_token' };
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === 'AbortError';

    circuitFailureCount += 1;
    if (circuitState === 'half-open' || circuitFailureCount >= CIRCUIT_FAILURE_THRESHOLD) {
      transitionToOpen();
    }

    console.warn(
      `Cap siteverify ${isTimeout ? 'timeout' : 'error'}:`,
      error instanceof Error ? error.message : 'unknown',
    );

    return { ok: false, reason: isTimeout ? 'timeout' : 'upstream_error' };
  } finally {
    clearTimeout(timeout);
  }
}

// 仅用于测试
export function resetCapCircuitForTest(): void {
  circuitState = 'closed';
  circuitOpenAt = 0;
  circuitFailureCount = 0;
}
