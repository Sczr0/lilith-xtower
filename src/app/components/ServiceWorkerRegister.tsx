"use client";

import { useEffect } from "react";

// 仅在非安全上下文（如 http 内网）或非生产环境跳过注册，避免干扰本地调试与
// 在不满足 PWA 要求的环境报错。
const isProd = process.env.NODE_ENV === "production";
const SW_URL = "/sw.js";

function registerServiceWorker() {
  // Service Worker 需要安全上下文（HTTPS 或 localhost）
  if (!("serviceWorker" in navigator)) return;
  if (typeof window !== "undefined" && !window.isSecureContext) return;

  navigator.serviceWorker
    .register(SW_URL, { scope: "/" })
    .then((registration) => {
      // 有新的 SW 等待接管时，通知其立即 skipWaiting（配合 sw.js 里的
      // skipWaiting + clients.claim，让更新尽快生效）。
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      // 页面可见时可触发更新检查，尽早拉到新版本资源。
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          registration.update().catch(() => {});
        }
      });
    })
    .catch(() => {
      // 注册失败（如浏览器不支持）静默忽略，不影响站点正常运行
    });
}

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!isProd) return;
    // 延后注册，避免与首屏关键路径竞争
    const run = () => registerServiceWorker();
    try {
      const idle = (
        window as Window & { requestIdleCallback?: typeof requestIdleCallback }
      ).requestIdleCallback;
      if (idle) {
        idle(run, { timeout: 2000 });
      } else {
        setTimeout(run, 1500);
      }
    } catch {
      setTimeout(run, 1500);
    }
  }, []);

  return null;
}
