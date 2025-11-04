"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";

type MetricName = "LCP" | "CLS" | "INP" | "TTFB" | "FCP" | "FID";

// 仅在生产环境并按采样率上报，避免影响开发体验与性能
const isProd = process.env.NODE_ENV === "production";
const SAMPLE_RATE = (() => {
  const raw = process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE;
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return 1; // 默认 100% 采样（可通过环境变量下调）
  return Math.min(Math.max(n, 0), 1);
})();

const MOBILE_ONLY = (() => {
  const raw = (process.env.NEXT_PUBLIC_WEB_VITALS_ONLY_MOBILE || "").toLowerCase();
  return raw === "1" || raw === "true";
})();

// 仅对 Umami 上报进行“扁平化 + 去高基数”处理；
// 发送到自建 /api/rum 则保留完整负载，便于未来复用/迁移。
function shapeUmamiWebVitalsPayload(payload: any): Record<string, unknown> {
  try {
    const out: Record<string, unknown> = {};
    // 保留可筛选的低基数字段
    if (typeof payload?.name === "string") out.name = payload.name as string;
    if (typeof payload?.rating === "string") out.rating = payload.rating as string;
    if (typeof payload?.nav === "string") out.nav = payload.nav as string;

    // 路径保留，但限制长度，避免极端基数
    if (typeof payload?.path === "string") {
      const p = payload.path as string;
      out.path = p.length > 160 ? p.slice(0, 160) : p;
    }

    // 数值：仅保留 value（四舍五入），不上传 id/viewId/t/delta 等高基数字段
    if (typeof payload?.value === "number" && Number.isFinite(payload.value)) {
      out.value = Math.round(payload.value * 1000) / 1000;
    }

    // 将 attribution 中的少量关键信息扁平化为顶层
    const attr = payload?.attribution;
    if (attr && typeof attr === "object") {
      const a: any = attr;
      if (typeof a.navigationType === "string") out.attr_navigationType = a.navigationType;
      if (typeof a.eventType === "string") out.attr_eventType = a.eventType;
      if (typeof a.interactionType === "string") out.attr_interactionType = a.interactionType;
      if (typeof a.loadState === "string") out.attr_loadState = a.loadState;
      if (typeof a.largestShiftValue === "number") out.attr_largestShiftValue = a.largestShiftValue;
    }

    return out;
  } catch (_) {
    return {};
  }
}

function maybeTrackWithUmami(event: string, payload: unknown) {
  try {
    // Umami v2：window.umami.track(evt, data)
    // 这里做运行时探测，不强依赖脚本是否加载完成
    const w = window as unknown as { umami?: { track?: (e: string, d?: unknown) => void } };
    if (w.umami && typeof w.umami.track === "function") {
      // 仅对 web-vitals 事件应用“瘦身 & 扁平化”，其他事件保持原样
      const data = event === "web-vitals" ? shapeUmamiWebVitalsPayload(payload as any) : payload;
      w.umami.track(event, data);
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
    const name: MetricName = metric?.name;

    // 端侧去重：同 name+id 仅上报一次
    const key = `${name}|${metric?.id}`;
    if (sentRef.current.has(key)) return;

    // 阈值过滤：
    if (typeof metric?.delta === "number") {
      if (metric.delta <= 0) return; // 仅在值增加时上报
      if (name === "CLS" && metric.delta < 0.001) return; // 丢弃极小抖动
    } else if (name === "CLS" && typeof metric?.value === "number" && metric.value < 0.001) {
      return;
    }

    // 设备优先：如启用仅移动端采样，则非移动端直接丢弃
    if (MOBILE_ONLY) {
      try {
        const ua = navigator.userAgent || "";
        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
        if (!isMobile) return;
      } catch (_) {}
    }

    // rating 非 good 时强制上报；good 按采样率
    const rating = metric?.rating as string | undefined;
    if (rating === "good" && Math.random() > SAMPLE_RATE) return;

    const payload = {
      id: metric?.id,
      name,
      value: typeof metric?.value === "number" ? Math.round(metric.value * 1000) / 1000 : metric?.value,
      rating,
      delta: metric?.delta,
      nav: metric?.navigationType,
      path: typeof location !== "undefined" ? location.pathname : undefined,
      viewId: viewIdRef.current,
      t: Date.now(),
      attribution: minimizeAttribution(metric?.attribution),
    };

    // 标记已发送，防止重复
    sentRef.current.add(key);

    if (!maybeTrackWithUmami("web-vitals", payload)) {
      sendToEndpoint(payload);
    }
  } catch (_) {}
}

export default function WebVitals() {
  // 页面视图分段：当 pathname 变化时，生成新的 viewId
  const pathname = usePathname();
  const counterRef = useRef(0);
  useEffect(() => {
    // 每次软导航（pathname 改变）时更新视图 ID
    const next = `${Date.now()}-${(counterRef.current = (counterRef.current + 1) % 1e6)}`;
    viewIdRef.current = next;
  }, [pathname]);

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

// 以下为组件级别的静态状态（跨次渲染保持）
const sentRef: { current: Set<string> } = { current: new Set() };
const viewIdRef: { current: string } = { current: `${Date.now()}-0` };
