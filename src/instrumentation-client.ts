// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { isAbortNoise } from "./app/lib/utils/abortNoise";

/**
 * cap-widget 内部的「预期失败」噪音，统一不上报。
 *
 * 背景：Cap 验证码在后台解题，失败时会走业务降级（无 token 时降级/提示重试），
 * 但组件内部仍可能把 rejection 抛到 window 上，被 Sentry 全局
 * onunhandledrejection（mechanism: auto.browser.global_handlers.onunhandledrejection）
 * 记为未捕获异常。已确认的两类：
 *
 * 1. `[cap] <label> timed out after 60000ms`
 *    cap-widget 的 60s 单任务硬超时（rsw / sha256-pow worker）。低端机、后台标签页
 *    被节流、webview 冻结 Worker 时必然出现，属于环境能力问题而非代码缺陷。
 * 2. `Failed to construct Worker`（SecurityError）
 *    cap-widget 在 custom element connectedCallback 里直接 `new Worker(blobURL)`：
 *    该 Promise 无人消费，CSP 未放行 `worker-src blob:` 或 webview（X5/QQ 等）
 *    拦截 blob worker 时必定产生未处理 rejection。
 *
 * 这些错误在客户端已被显式处理（降级/重试/冷却），保留上报只会淹没真实缺陷。
 * 注意：这里只做「消息指纹」匹配，不做宽泛的类型/名称匹配，避免误伤 CSP、
 * 跨域等同名的真实错误。
 */
const CAP_NOISE_PATTERNS: readonly RegExp[] = [
  /\[cap\]\s+[\w-]+ worker #\d+ timed out after \d+ms/i,
  /timed out after 60000ms/i,
  // Chrome: Failed to construct 'Worker': ... / Firefox: Failed to construct Worker
  /failed to construct '?worker'?/i,
  /refused to create a worker from/i,
];

function isCapWidgetNoise(message: string | undefined): boolean {
  if (!message) return false;
  return CAP_NOISE_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * 第三方浏览器扩展的「CSP 拦截 eval」噪音，统一不上报。
 *
 * 背景：部分扩展（如 AIX 下载器，bundle 名为 `sm.bundle.js`，模块名形如
 * `aixdownload-v3_<buildId>_<rand>`）会把脚本注入 MAIN world，内部用
 * `new Function` 解析 JSON。本站 CSP 只放行 `'wasm-unsafe-eval'`、未放行
 * `'unsafe-eval'`，于是扩展脚本抛 EvalError：
 *
 *   EvalError: Evaluating a string as JavaScript violates the following Content
 *   Security Policy directive ... because 'unsafe-eval' is not an allowed source of script
 *
 * 由于扩展是在页面世界注册事件监听（EventTarget/addEventListener），该 EvalError 会
 * 经过 Sentry BrowserApiErrors 包装过的监听器冒泡（mechanism:
 * auto.browser.browserapierrors.addEventListener），被记成「本站未捕获异常」。
 * 注意 Sentry 的 NextjsClientStackFrameNormalization 会把
 * `chrome-extension://<id>/sm.bundle.js` 改写成 `app:///sm.bundle.js`，容易误判成本站代码。
 *
 * 判定条件（两者同时满足才过滤，宁可多报也不吞自家问题）：
 * 1. 消息是 CSP 拒绝 eval 的 EvalError；
 * 2. 原始栈（未经 Sentry 改写的 hint.originalException.stack）里出现扩展协议 scheme。
 * 本站代码全部走 /_next/static/，不会产生扩展 scheme 的帧。
 */
const CSP_EVAL_VIOLATION_PATTERN =
  /violates the following content security policy directive/i;
const EXTENSION_FRAME_PATTERN =
  /(?:chrome|moz|safari-web|safari|ms-browser)-extension:\/\//i;

function isThirdPartyCspEvalNoise(
  message: string | undefined,
  originalException: unknown,
): boolean {
  if (!message || !CSP_EVAL_VIOLATION_PATTERN.test(message)) return false;
  if (!originalException || typeof originalException !== 'object') return false;
  const stack = (originalException as { stack?: unknown }).stack;
  return typeof stack === 'string' && EXTENSION_FRAME_PATTERN.test(stack);
}

Sentry.init({
  dsn: "https://62ab27a5251bb7c188c069542dee68d9@o4512039224737792.ingest.de.sentry.io/4512039239286864",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // 预期噪声不上报（见上方 CAP_NOISE_PATTERNS / CSP eval / abort 说明）
  beforeSend(event, hint) {
    const message = event.exception?.values?.[0]?.value ?? hint?.originalException?.toString();
    if (isCapWidgetNoise(message)) {
      return null;
    }
    if (isThirdPartyCspEvalNoise(message, hint?.originalException)) {
      return null;
    }
    // 主动取消请求产生的 AbortError（含 WebKit 的 "Fetch is aborted" 上游 bug）。
    // 详见 src/app/lib/utils/abortNoise.ts。
    if (isAbortNoise(message)) {
      return null;
    }
    return event;
  },

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
