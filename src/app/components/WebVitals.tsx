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

const isProd = process.env.NODE_ENV === "production";
const SAMPLE_RATE = (() => {
  const raw = process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE;
  const n = raw ? Number(raw) : Number.NaN;
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(n, 0), 1);
})();

const MOBILE_ONLY = (() => {
  const raw = (process.env.NEXT_PUBLIC_WEB_VITALS_ONLY_MOBILE || "").toLowerCase();
  return raw === "1" || raw === "true";
})();

const sentRef: { current: Set<string> } = { current: new Set() };
const viewIdRef: { current: string } = { current: `${Date.now()}-0` };

function isMetricWithAttribution(
  metric: WebVitalsMetric,
): metric is MetricWithAttribution {
  return "attribution" in metric;
}

function sendToEndpoint(payload: WebVitalsPayload) {
  try {
    const body = JSON.stringify(payload);
    const url = "/api/rum";

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }

    fetch(url, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => {});
  } catch {
    // ignore reporting failures
  }
}

function minimizeAttribution(
  attr: MetricWithAttribution["attribution"] | undefined,
) {
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

  for (const key of keys) {
    if (key in source) out[key] = source[key];
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

function reportMetric(metric: WebVitalsMetric) {
  try {
    if (!isProd) return;

    const name = metric?.name as MetricName | undefined;
    if (!name) return;

    const key = `${name}|${metric.id}`;
    if (sentRef.current.has(key)) return;

    const delta =
      typeof (metric as MetricWithAttribution).delta === "number"
        ? (metric as MetricWithAttribution).delta
        : undefined;
    if (delta !== undefined) {
      if (delta <= 0) return;
      if (name === "CLS" && delta < 0.001) return;
    } else if (name === "CLS" && typeof metric?.value === "number" && metric.value < 0.001) {
      return;
    }

    if (MOBILE_ONLY) {
      try {
        const ua = navigator.userAgent || "";
        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
        if (!isMobile) return;
      } catch {
        // ignore user-agent read failures
      }
    }

    const rating = metric?.rating as string | undefined;
    if (rating === "good" && Math.random() > SAMPLE_RATE) return;

    const payload: WebVitalsPayload = {
      id: metric?.id,
      name,
      value:
        typeof metric?.value === "number"
          ? Math.round(metric.value * 1000) / 1000
          : undefined,
      rating,
      delta,
      nav: (metric as MetricWithAttribution).navigationType,
      path: typeof location !== "undefined" ? location.pathname : undefined,
      viewId: viewIdRef.current,
      t: Date.now(),
      attribution: minimizeAttribution(
        isMetricWithAttribution(metric) ? metric.attribution : undefined,
      ),
    };

    sentRef.current.add(key);
    sendToEndpoint(payload);
  } catch {
    // ignore metric reporting failures
  }
}

export default function WebVitals() {
  const pathname = usePathname();
  const counterRef = useRef(0);

  useEffect(() => {
    const next = `${Date.now()}-${(counterRef.current = (counterRef.current + 1) % 1_000_000)}`;
    viewIdRef.current = next;
  }, [pathname]);

  useEffect(() => {
    const run = () => {
      import("web-vitals/attribution")
        .then((mod) => {
          mod.onLCP(reportMetric);
          mod.onCLS(reportMetric);
          mod.onINP(reportMetric);
          mod.onTTFB(reportMetric);
          mod.onFCP(reportMetric);
          if (typeof mod.onFID === "function") {
            mod.onFID(reportMetric as (metric: Metric) => void);
          }
        })
        .catch(() => {});
    };

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
