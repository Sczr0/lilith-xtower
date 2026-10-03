/**
 * 带超时的上游 fetch 封装。
 *
 * 背景：登录、会话校验、扫码登录、爱发电、飞书 webhook 等链路此前直接裸调 fetch，
 * 上游挂起时请求会无限占用 worker（直到平台超时）。这里统一补 AbortController 超时，
 * 复用既有路由（如 api/image/bn/route.ts）中散落的同款模式。
 *
 * 跨洋连接复用：这里刻意使用运行时内置的全局 fetch（Node 内置 undici 的默认 Agent，
 * keepAliveTimeout 约 4s），而不引入独立 undici 包自建连接池——生产运行时是 Node 20.x，
 * 独立 undici 版本一旦高于内置版本就会在加载期直接抛错（曾因此导致 /api/internal/taptap
 * 与 /sponsors 500，见 LILITH-XTOWER-17/18）。服务端扫码轮询节奏为 1s（slow_down 封顶 8s），
 * 落在默认保活窗口内，跨洋 TCP/TLS 连接在轮询期间会被复用。
 *
 * 语义：
 * - 超时后以 AbortError 拒绝，调用方沿用既有的 /aborted|abort/i 判定返回 504/502；
 * - 调用方已有 signal 时通过 AbortSignal.any 叠加，任一 abort 即中断。
 */

const DEFAULT_TIMEOUT_MS = 15_000;

export async function upstreamFetch(
  input: string | URL,
  init: RequestInit = {},
  options: { timeoutMs?: number } = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const signal = init.signal
    ? AbortSignal.any([init.signal, controller.signal])
    : controller.signal;

  try {
    return await fetch(input, { ...init, signal });
  } finally {
    clearTimeout(timer);
  }
}
