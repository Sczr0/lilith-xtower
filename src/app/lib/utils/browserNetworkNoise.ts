/**
 * 浏览器「网络层失败」噪音识别。
 *
 * 背景：fetch 在传输层失败时，抛出的 TypeError 文案由浏览器写死、各引擎不同：
 *
 *   - WebKit / Safari ：TypeError: Load failed              （可能附带 "(host)"）
 *   - Chromium        ：TypeError: Failed to fetch
 *   - Firefox         ：NetworkError when attempting to fetch resource.
 *
 * 这类失败是环境性的（断网、连接被重置、DNS 失败、被 CSP 拦截），本身不是代码缺陷；
 * 且本站的调用方都已用 try/catch 把它降级成「加载失败，请检查网络后重试」，用户侧
 * 已有明确反馈，再上报只是淹没真实缺陷。
 *
 * 为什么可以「只看消息」就过滤？
 * 本站代码从不构造这些文案：本站抛出的 Error 一律带业务前缀（如
 * `Failed to fetch font: …`、`获取 RKS 列表失败`），与浏览器原生文案不会混淆；
 * 因此按整串锚定匹配不可能吞掉自家代码的错误。
 *
 * 为什么必须靠 beforeSend，而不是调用方 catch？
 * WebKit 存在已知问题：fetch 在响应体读取阶段失败或被 abort 时，会在原本的 Promise
 * 链之外再产生一个 rejection，直接冒泡到 window.onunhandledrejection，try/catch 无法
 * 捕获（同类问题见 abortNoise.ts 引用的 WebKit bug 215771）。生产环境只有
 * /_next/static 压缩帧、无法据栈定位调用方，只能在过滤层消除。
 *
 * 说明：更早的实现（isThirdPartyRumNoise）要求消息命中网络失败文案**且**栈里出现阿里云
 * ESA 拨测脚本指纹。但线上实测的未捕获 rejection 全部来自本站自己的 /api/* 请求，
 * 栈里只有本站压缩帧，永远不会带 ESA 指纹，于是 4 个 issue 长期挂在线上。收敛为
 * 「消息整串锚定」后语义更准确，且不再需要指纹文本。
 */

const BROWSER_NETWORK_FAILURE_PATTERNS: readonly RegExp[] = [
  // WebKit / Safari（fetch 失败、含被 CSP 拦截）
  /^(?:typeerror:\s*)?load failed(?:\s*\([^)]*\))?\.?$/i,
  // Chromium
  /^(?:typeerror:\s*)?failed to fetch(?:\s*\([^)]*\))?\.?$/i,
  // Firefox
  /^networkerror(?: when attempting to fetch resource)?\.?$/i,
];

/**
 * 判断一条错误是否来自浏览器网络层的传输失败。
 *
 * @param message 错误消息（event.exception.values[0].value 或异常的 toString()）
 */
export function isBrowserNetworkFailureNoise(message: string | undefined | null): boolean {
  if (!message) return false;
  const trimmed = message.trim();
  return BROWSER_NETWORK_FAILURE_PATTERNS.some((pattern) => pattern.test(trimmed));
}
