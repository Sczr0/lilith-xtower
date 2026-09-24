// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://62ab27a5251bb7c188c069542dee68d9@o4512039224737792.ingest.de.sentry.io/4512039239286864",

  // 仅生产环境上报。本地开发与自测（/boom-test、/bt/* 冒烟路由、curl 直打 server
  // action）此前都会以默认的 environment=production 打进线上视图，污染真实缺陷排查。
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.NODE_ENV,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  // 默认 0.1：100% 采样在 2H2G 源站开销显著；需要全量排查时用 SENTRY_TRACES_SAMPLE_RATE=1 临时调回。
  tracesSampleRate: Math.min(Math.max(Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1), 0), 1),

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});
