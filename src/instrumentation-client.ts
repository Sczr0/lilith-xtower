// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { isAbortNoise } from "./app/lib/utils/abortNoise";
import { isBrowserNetworkFailureNoise } from "./app/lib/utils/browserNetworkNoise";
import { isInjectedScriptNoise } from "./app/lib/utils/injectedScriptNoise";

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
 * 第三方注入脚本被 CSP 拦截 eval 的噪音，统一不上报。
 *
 * 背景：部分浏览器扩展 / 宿主 WebView 会把脚本注入页面主世界（MAIN world），内部用
 * `new Function` / `eval` 解析数据。本站 CSP 只放行 `'wasm-unsafe-eval'`、未放行
 * `'unsafe-eval'`，于是这些脚本抛 EvalError。由于脚本是在页面世界注册监听器
 * （EventTarget/addEventListener / setTimeout），异常会经 Sentry BrowserApiErrors
 * 的包装冒泡，被记成「本站未捕获异常」。
 *
 * 各引擎文案不同，两种都要覆盖：
 *   - Chromium：`Evaluating a string as JavaScript violates the following Content
 *     Security Policy directive …`（含 "violates the following … directive"）
 *   - WebKit  ：`Refused to evaluate a string as JavaScript because 'unsafe-eval' or
 *     'trusted-types-eval' is not an allowed source of script in the following
 *     Content Security Policy directive …`（含 "is not an allowed source of script"）
 * 此前只匹配 Chromium 措辞，导致 iPad/WKWebView 上的同类噪音漏报
 * （LILITH-XTOWER-T 即为此例）。
 *
 * 为什么不再要求栈里出现扩展 scheme？
 * WKWebView 的注入脚本来自 WKUserScript，并没有 `*-extension://` 帧，旧条件在 Safari 上
 * 永远不成立。改为「只看文案」是安全的：本仓库全部代码都不使用 eval / new Function
 * （CSP 也未放行 `unsafe-eval`），因此任何「CSP 拒绝 eval」的异常都不可能是本站代码。
 */
const CSP_EVAL_VIOLATION_PATTERN =
  /(?:violates the following content security policy directive|is not an allowed source of script in the following content security policy directive|refused to evaluate a string as javascript)/i;

function isThirdPartyCspEvalNoise(message: string | undefined): boolean {
  if (!message) return false;
  return CSP_EVAL_VIOLATION_PATTERN.test(message);
}

/** 汇总异常调用栈各帧的文件名，用于「注入脚本」判定。 */
function collectFrameFilenames(event: Sentry.Event): string[] {
  const frames: string[] = [];
  for (const exception of event.exception?.values ?? []) {
    for (const frame of exception.stacktrace?.frames ?? []) {
      frames.push(frame.filename ?? "");
    }
  }
  return frames;
}

Sentry.init({
  dsn: "https://62ab27a5251bb7c188c069542dee68d9@o4512039224737792.ingest.de.sentry.io/4512039239286864",

  // 仅生产环境上报。本地开发与自测（/boom-test、/bt/* 冒烟路由、curl 直打
  // server action）此前都会以默认的 environment=production 打进线上视图，
  // 污染真实缺陷的排查（对应 LILITH-XTOWER-A/B/C/D/F/G/H/K/M/J/E/9）。
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.NODE_ENV,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  // 默认 0.1：100% 采样会让每个请求都做全量性能追踪，在低端移动端与 2H2G 源站开销显著。
  // 需要全量排查时用 NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=1 临时调回。
  tracesSampleRate: Math.min(Math.max(Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || 0.1), 0), 1),

  // 预期噪声不上报（见上方 CAP / CSP eval / abort / 网络失败 / 注入脚本 说明）
  beforeSend(event, hint) {
    const message = event.exception?.values?.[0]?.value ?? hint?.originalException?.toString();
    if (isCapWidgetNoise(message)) {
      return null;
    }
    if (isThirdPartyCspEvalNoise(message)) {
      return null;
    }
    // 主动取消请求产生的 AbortError（含 WebKit 的 "Fetch is aborted" 上游 bug）。
    // 详见 src/app/lib/utils/abortNoise.ts。
    if (isAbortNoise(message)) {
      return null;
    }
    // 浏览器网络层失败（WebKit "Load failed" / Chromium "Failed to fetch" /
    // Firefox "NetworkError …"）。详见 src/app/lib/utils/browserNetworkNoise.ts。
    if (isBrowserNetworkFailureNoise(message)) {
      return null;
    }
    // 第三方 / 宿主 WebView 注入脚本的异常（LIDNotify、window.android 等）。
    // 详见 src/app/lib/utils/injectedScriptNoise.ts。
    if (isInjectedScriptNoise(message, collectFrameFilenames(event))) {
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
