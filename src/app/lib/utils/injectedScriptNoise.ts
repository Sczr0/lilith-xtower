/**
 * 第三方 / 宿主环境注入脚本产生的全局噪音识别。
 *
 * 背景：本站页面会承载来自浏览器扩展、运营商或套壳 WebView（X5、百度、QQ 等）以及
 * 宿主 App 的注入脚本。这些脚本运行在页面主世界（MAIN world），其未捕获异常会被
 * Sentry 的全局 handler 记成「本站未捕获异常」。已确认两例：
 *
 * 1. `ReferenceError: LIDNotify is not defined`（/dashboard）
 *    注入脚本在自身定义之前就调用了全局 `LIDNotify`；栈只有一帧 `<anonymous>:1:1`。
 * 2. `TypeError: window.android.unLoad is not a function`（/，百度 / 华为 WebView）
 *    注入脚本假设宿主提供了 JS Bridge `window.android`，但该 WebView 并未提供；
 *    真帧是 `<anonymous>:1:915`，另有帧是 Sentry 自己的 addEventListener 包装。
 *
 * `LIDNotify` 与 `window.android` 在本仓库（源码 / 构建产物 / 配置）中均不存在，
 * 不可能是本站代码。
 *
 * 判定条件（满足其一即视为噪音）：
 * 1. 消息命中已知注入脚本指纹；
 * 2. 消息是「全局未定义 / 不是函数」，且调用栈里**没有任何非匿名帧**。
 *    本站代码全部是打包产物，必然带 /_next/static 帧，不会只剩 <anonymous>。
 *
 * 说明：这里刻意不按「全局未定义」直接放行，避免吞掉本站真实的 ReferenceError。
 */

const KNOWN_INJECTED_PATTERNS: readonly RegExp[] = [
  // 百度等套壳浏览器的注入脚本
  /\blidnotify\b/i,
  // 期望宿主提供 Android JS Bridge、但 WebView 未注入该桥
  /window\.android\.\w+ is not a function/i,
];

const GLOBAL_ACCESS_ERROR = /\bis not (?:a function|defined)\b/i;

/** Sentry 对无源信息的内联帧通常标记为 <anonymous> / <unknown>，或直接留空 */
function isAnonymousFrame(filename: string | undefined): boolean {
  if (!filename) return true;
  const normalized = filename.trim().toLowerCase();
  return (
    normalized === '' ||
    normalized.startsWith('<anonymous') ||
    normalized.startsWith('<unknown')
  );
}

/**
 * 判断一条错误是否来自页面中第三方 / 宿主注入的脚本。
 *
 * @param message        错误消息
 * @param frameFilenames 调用栈各帧的文件名（event.exception.values[*].stacktrace.frames[*].filename）
 */
export function isInjectedScriptNoise(
  message: string | undefined | null,
  frameFilenames: readonly (string | undefined)[],
): boolean {
  if (!message) return false;
  if (KNOWN_INJECTED_PATTERNS.some((pattern) => pattern.test(message))) return true;
  if (!GLOBAL_ACCESS_ERROR.test(message)) return false;
  if (frameFilenames.length === 0) return false;
  return frameFilenames.every(isAnonymousFrame);
}
