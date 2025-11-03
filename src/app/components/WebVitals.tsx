"use client";

import { useEffect } from "react";

type MetricName = "LCP" | "CLS" | "INP" | "TTFB" | "FCP" | "FID";

// 仅在生产环境并按采样率上报，避免影响开发体验与性能
const isProd = process.env.NODE_ENV === "production";
const SAMPLE_RATE = (() => {
  const raw = process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE;
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return 1; // 默认 100% 采样（可通过环境变量下调）
  return Math.min(Math.max(n, 0), 1);
})();

function maybeTrackWithUmami(event: string, payload: unknown) {
  try {
    // Umami v2：window.umami.track(evt, data)
    // 这里做运行时探测，不强依赖脚本是否加载完成
    const w = window as unknown as { umami?: { track?: (e: string, d?: unknown) => void } };
    if (w.umami && typeof w.umami.track === "function") {
      w.umami.track(event, payload);
      return true;
    }
  } catch (_) {}
  return false;
}

function sendToEndpoint(payload: unknown) {
  try {
    const body = JSON.stringify(payload);
    const url = "/api/rum";
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
    } else {
      // keepalive 允许在页面卸载时仍尽力发送
      fetch(url, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body,
      }).catch(() => {});
    }
  } catch (_) {}
}

function minimizeAttribution(attr: any) {
  if (!attr || typeof attr !== "object") return undefined;
  const out: Record<string, unknown> = {};
  const keys = [
    "element",
    "url",
    "loadState",
    "navigationType",
    "eventTarget",
    "eventType",
    "interactionType",
    "inputDelay",
    "processingDuration",
    "presentationDelay",
    "largestShiftValue",
  ];
  for (const k of keys) if (k in attr) out[k] = attr[k];
  return Object.keys(out).length ? out : undefined;
}

function reportMetric(metric: any) {
  try {
    if (!isProd) return;
    if (Math.random() > SAMPLE_RATE) return;

    const name: MetricName = metric?.name;
    const payload = {
      id: metric?.id,
      name,
      value: typeof metric?.value === "number" ? Math.round(metric.value * 1000) / 1000 : metric?.value,
      rating: metric?.rating,
      delta: metric?.delta,
      nav: metric?.navigationType,
      path: typeof location !== "undefined" ? location.pathname : undefined,
      t: Date.now(),
      attribution: minimizeAttribution(metric?.attribution),
    };

    if (!maybeTrackWithUmami("web-vitals", payload)) {
      sendToEndpoint(payload);
    }
  } catch (_) {}
}

export default function WebVitals() {
  useEffect(() => {
    // 在空闲期再加载与注册，尽量规避首屏关键路径
    const run = () => {
      import("web-vitals/attribution")
        .then((mod) => {
          // 仅注册核心指标；保持默认仅上报最终值（非 reportAllChanges）
          mod.onLCP(reportMetric);
          mod.onCLS(reportMetric);
          mod.onINP(reportMetric);
          mod.onTTFB(reportMetric);
          mod.onFCP(reportMetric);
          // 可选：非核心但仍有参考意义
          if (typeof mod.onFID === "function") mod.onFID(reportMetric as any);
        })
        .catch(() => {});
    };

    try {
      if ("requestIdleCallback" in window) {
        (window as any).requestIdleCallback(run, { timeout: 2000 });
      } else {
        // 退化方案：轻微延迟后执行
        setTimeout(run, 1500);
      }
    } catch (_) {
      setTimeout(run, 1500);
    }
  }, []);

  return null;
}

