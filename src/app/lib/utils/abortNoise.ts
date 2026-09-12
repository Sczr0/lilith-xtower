/**
 * 主动取消请求产生的 AbortError 噪音识别。
 *
 * 背景：本站会在组件卸载 / 切换登录方式 / 二维码过期 / 请求超时时主动
 * `AbortController.abort()` 取消进行中的请求。这类取消在业务上已被显式处理
 * （`try/catch` + `name === 'AbortError'`），属于预期行为，不应被上报成
 * 「未捕获异常」。
 *
 * 为什么 `try/catch` 之外还要按消息过滤？
 * WebKit 存在一个已知 bug：fetch 在「响应体读取过程中」被 abort 时，会在返回给
 * 调用方的 Promise 之外再产生一个额外的 rejection，绕过原始 Promise 链直接冒泡到
 * `window.onunhandledrejection`，因此无法通过 `try/catch` 捕获：
 *
 *   AbortError: Fetch is aborted
 *
 * 上游 bug：https://bugs.webkit.org/show_bug.cgi?id=215771（状态 RESOLVED
 * CONFIGURATION CHANGED，但旧版 iOS/macOS Safari 仍会命中）。Sentry 官方也用
 * 相同思路在 `beforeSend` 中过滤。
 *
 * 说明：这里只做「消息指纹」匹配，不做宽泛的 `name === 'AbortError'` 匹配，
 * 避免误伤同名但语义不同的真实错误；同时刻意不匹配 `TimeoutError`，因为超时
 * 往往指向真实的服务端/网络问题，需要保留可观测性。
 */

const ABORT_MESSAGE_PATTERNS: readonly RegExp[] = [
  // WebKit / Safari（含 macOS/iOS）：fetch abort 的上游 bug 指纹
  /fetch is aborted/i,
  // Chromium / undici 的通用 abort 文案
  /the operation was aborted/i,
  /the user aborted a request/i,
  // AbortSignal.throwIfAborted() / 无 reason 的 abort
  /signal is aborted without reason/i,
];

/**
 * 判断一条错误消息是否属于「请求被主动取消」的噪音。
 *
 * @param message 错误消息（可能是 `event.exception.values[0].value`，
 *                也可能是异常的 `toString()`，例如 `AbortError: Fetch is aborted`）
 */
export function isAbortNoise(message: string | undefined | null): boolean {
  if (!message) return false;
  return ABORT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}
