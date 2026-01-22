"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { Metric, MetricWithAttribution } from "web-vitals";

type MetricName = "LCP" | "CLS" | "INP" | "TTFB" | "FCP" | "FID";
type WebVitalsMetric = Metric | MetricWithAttribution;

type WebVitalsPayload = {
  id?: string;
  name: MetricName;
  value?: number;
  rating?: string;
  delta?: number;
  nav?: string;
  path?: string;
  viewId?: string;
  t: number;
  attribution?: ReturnType<typeof minimizeAttribution>;
};

// 仅在生产环境并按采样率上报，避免影响开发体验与性能
const isProd = process.env.NODE_ENV === "production";
const SAMPLE_RATE = (() => {
  const raw = process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE;
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(n, 0), 1);
})();

const MOBILE_ONLY = (() => {
  const raw = (process.env.NEXT_PUBLIC_WEB_VITALS_ONLY_MOBILE || "").toLowerCase();
  return raw === "1" || raw === "true";
})();

const sentRef: { current: Set<string> } = { current: new Set() };
const viewIdRef: { current: string } = { current: `${Date.now()}-0` };

function isMetricWithAttribution(metric: WebVitalsMetric): metric is MetricWithAttribution {
  return "attribution" in metric;
}

// 仅对 Umami 上报进行“扁平化 + 去高基数”处理；发送到自建 /api/rum 则保留完整字段
function shapeUmamiWebVitalsPayload(payload: WebVitalsPayload): Record<string, unknown> {
  try {
    const out: Record<string, unknown> = {};
    if (typeof payload.name === "string") out.name = payload.name;
    if (typeof payload.rating === "string") out.rating = payload.rating;
    if (typeof payload.nav === "string") out.nav = payload.nav;
    if (typeof payload.path === "string") out.path = payload.path.length > 160 ? payload.path.slice(0, 160) : payload.path;
    if (typeof payload.value === "number" && Number.isFinite(payload.value)) {
      out.value = Math.round(payload.value * 1000) / 1000;
    }

    const attr = payload.attribution;
    if (attr && typeof attr === "object") {
      if (typeof attr.navigationType === "string") out.attr_navigationType = attr.navigationType;
      if (typeof attr.eventType === "string") out.attr_eventType = attr.eventType;
      if (typeof attr.interactionType === "string") out.attr_interactionType = attr.interactionType;
      if (typeof attr.loadState === "string") out.attr_loadState = attr.loadState;
      if (typeof attr.largestShiftValue === "number") out.attr_largestShiftValue = attr.largestShiftValue;
    }

    return out;
  } catch {
    return {};
  }
}

function maybeTrackWithUmami(event: string, payload: WebVitalsPayload | unknown) {
  try {
    const w = window as Window & { umami?: { track?: (e: string, d?: unknown) => void } };
    if (w.umami && typeof w.umami.track === "function") {
      const data =
        event === "web-vitals" && payload && typeof payload === "object"
          ? shapeUmamiWebVitalsPayload(payload as WebVitalsPayload)
          : payload;
      w.umami.track(event, data);
      return true;
    }
  } catch {
    /* swallow */
  }
  return false;
}

function sendToEndpoint(payload: WebVitalsPayload) {
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
  } catch {
    /* swallow */
  }
}

function minimizeAttribution(attr: MetricWithAttribution["attribution"] | undefined) {
  if (!attr || typeof attr !== "object") return undefined;
  const source = attr as Record<string, unknown>;
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
  for (const k of keys) {
    if (k in source) out[k] = source[k];
  }
  return Object.keys(out).length ? out : undefined;
}

function reportMetric(metric: WebVitalsMetric) {
  try {
    if (!isProd) return;
    const name = metric?.name as MetricName | undefined;
    if (!name) return;

    // 端侧去重：同 name+id 仅上报一次
    const key = `${name}|${metric.id}`;
    if (sentRef.current.has(key)) return;

    // 阈值过滤
    if (typeof (metric as MetricWithAttribution).delta === "number") {
      const delta = (metric as MetricWithAttribution).delta;
      if (delta <= 0) return;
      if (name === "CLS" && delta < 0.001) return;
    } else if (name === "CLS" && typeof metric?.value === "number" && metric.value < 0.001) {
      return;
    }

    // 设备优先：若启用仅移动端采样，则非移动端直接丢弃
    if (MOBILE_ONLY) {
      try {
        const ua = navigator.userAgent || "";
        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
        if (!isMobile) return;
      } catch {
        /* ignore UA errors */
      }
    }

    // rating 为 good 时按采样率；非 good 强制上报
    const rating = metric?.rating as string | undefined;
    if (rating === "good" && Math.random() > SAMPLE_RATE) return;

    const payload: WebVitalsPayload = {
      id: metric?.id,
      name,
      value: typeof metric?.value === "number" ? Math.round(metric.value * 1000) / 1000 : undefined,
      rating,
      delta: (metric as MetricWithAttribution).delta,
      nav: (metric as MetricWithAttribution).navigationType,
      path: typeof location !== "undefined" ? location.pathname : undefined,
      viewId: viewIdRef.current,
      t: Date.now(),
      attribution: minimizeAttribution(isMetricWithAttribution(metric) ? metric.attribution : undefined),
    };

    sentRef.current.add(key);

    // 暂时取消 Umami 上报，强制走 /api/rum (Axiom)
    // if (!maybeTrackWithUmami("web-vitals", payload)) {
      sendToEndpoint(payload);
    // }
  } catch {
    /* swallow */
  }
}

export default function WebVitals() {
  // 页面视图分段：当 pathname 变化时，生成新的 viewId
  const pathname = usePathname();
  const counterRef = useRef(0);
  useEffect(() => {
    const next = `${Date.now()}-${(counterRef.current = (counterRef.current + 1) % 1_000_000)}`;
    viewIdRef.current = next;
  }, [pathname]);

  useEffect(() => {
    // 在空闲期再加载与注册，尽量规避首屏关键路径
    const run = () => {
      import("web-vitals/attribution")
        .then((mod) => {
          mod.onLCP(reportMetric);
          mod.onCLS(reportMetric);
          mod.onINP(reportMetric);
          mod.onTTFB(reportMetric);
          mod.onFCP(reportMetric);
          if (typeof mod.onFID === "function") mod.onFID(reportMetric as (metric: Metric) => void);
        })
        .catch(() => {});
    };

    try {
      const idle = (window as Window & { requestIdleCallback?: typeof requestIdleCallback }).requestIdleCallback;
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
