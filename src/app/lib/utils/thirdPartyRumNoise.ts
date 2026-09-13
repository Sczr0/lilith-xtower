/**
 * 阿里云 ESA 边缘注入的 RUM（前端监控）脚本产生的噪音识别。
 *
 * 背景：本站部署在阿里云 ESA 后面，ESA 会在边缘向 HTML 注入两个监控脚本：
 *
 *   <script src="https://rjsprbi.myalicdn.com/rum_common.js"></script>
 *   <script src="https://rjsperf.myalicdn.com/auto.js"></script>
 *
 * 其中 rum_common.js 会做「网络质量拨测」：先 POST
 * `https://rumtc.myalicdn.com/v1/common/manage` 拉取任务列表，再对任务目标并发
 * fetch（实测目标为 `https://rumprbjs-sp.ialicdn.com/target{1,2,3}/test{1,2,3}.jpg`），
 * 即其内部 `Promise.all(tasks.map(probe))`。
 *
 * 本站 CSP 的 `connect-src` 只放行了监控域名 `*.myalicdn.com`（用于上报），没有
 * 放行拨测域名 `*.ialicdn.com`，因此拨测 fetch 被 CSP 拦下。Safari/WebKit 对被
 * 拦截的 fetch 抛：
 *
 *   TypeError: Load failed (rumprbjs-sp.ialicdn.com)
 *
 * 而 rum_common.js 末尾的
 *
 *   try { l("https://rumtc.myalicdn.com/v1/common/manage", "0.0.3") } catch (t) {}
 *
 * 中的 `l` 是 async 函数，`try/catch` 只能包住同步调用，无法捕获其内部 Promise 的
 * rejection，于是冒泡成 window.onunhandledrejection，被 Sentry 记成「本站未捕获
 * 异常」（mechanism: auto.browser.global_handlers.onunhandledrejection）。
 *
 * 这不是本站代码的问题：本站脚本全部走 /_next/static/，不会出现以下指纹。保留
 * 上报只会淹没真实缺陷。
 *
 * 判定条件（两者同时满足，宁可多报也不吞自家问题）：
 * 1. 消息是浏览器对「网络加载失败」的固定文案（WebKit / Chromium / Firefox）；
 * 2. 调用栈 / breadcrumb 中出现 ESA RUM 脚本名或拨测域名的指纹。
 */

const NETWORK_LOAD_FAILURE_PATTERNS: readonly RegExp[] = [
  // WebKit / Safari（fetch 失败、含 CSP 拦截）
  /\bload failed\b/i,
  // Chromium
  /\bfailed to fetch\b/i,
  // Firefox
  /networkerror when attempting to fetch resource/i,
];

const ESA_RUM_FINGERPRINT_PATTERNS: readonly RegExp[] = [
  // ESA 注入的拨测脚本（Sentry 会把未知 scheme 的帧改写成 app:///rum_common.js）
  /\brum_common\.js\b/i,
  // 拨测目标域名（rumprbjs-sp.ialicdn.com 等）
  /\brumprbjs\b/i,
  /\b[a-z0-9-]+\.ialicdn\.com\b/i,
  // ESA 监控脚本 / 上报域名
  /\b[a-z0-9-]+\.myalicdn\.com\b/i,
];

/**
 * 判断一条错误是否来自阿里云 ESA 注入的 RUM 拨测脚本的「预期失败」。
 *
 * @param message   错误消息（event.exception.values[0].value 或异常的 toString()）
 * @param haystack  用于指纹匹配的文本：调用栈 + breadcrumb URL 等（换行拼接即可）
 */
export function isThirdPartyRumNoise(
  message: string | undefined | null,
  haystack: string | undefined | null,
): boolean {
  if (!message || !haystack) return false;
  if (!NETWORK_LOAD_FAILURE_PATTERNS.some((pattern) => pattern.test(message))) return false;
  return ESA_RUM_FINGERPRINT_PATTERNS.some((pattern) => pattern.test(haystack));
}
