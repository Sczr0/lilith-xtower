// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

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

Sentry.init({
  dsn: "https://62ab27a5251bb7c188c069542dee68d9@o4512039224737792.ingest.de.sentry.io/4512039239286864",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // cap-widget 的预期失败不上报（见上方 CAP_NOISE_PATTERNS 说明）
  beforeSend(event, hint) {
    const message = event.exception?.values?.[0]?.value ?? hint?.originalException?.toString();
    if (isCapWidgetNoise(message)) {
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
