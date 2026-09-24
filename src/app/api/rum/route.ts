import { NextRequest } from "next/server";
import { Logger } from 'next-axiom';

import { resolveClientIp, slidingWindowAllow } from '@/app/lib/api/rateLimit';

export const runtime = "nodejs";

const ALLOWED_NAMES = new Set(["LCP", "CLS", "INP", "TTFB", "FCP", "FID"]);

/** 公开端点限流：单 IP 60 次/分钟，防止被刷成对 Axiom 的放大攻击。 */
const RUM_RATE_LIMIT = 60;
const RUM_RATE_WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const log = new Logger();

  // 限流先于一切解析：超限直接 204，保持 sendBeacon 快速返回语义
  if (!slidingWindowAllow(`rum:${resolveClientIp(req)}`, RUM_RATE_LIMIT, RUM_RATE_WINDOW_MS)) {
    return new Response(null, { status: 204 });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return new Response("Bad Request", { status: 400 });
    }
    const raw = await req.json();

    // 基本字段校验与瘦身
    const cleaned = (() => {
      const d = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
      const name = typeof d.name === "string" ? d.name : undefined;
      const value: number | undefined = typeof d.value === "number" ? d.value : undefined;
      const rating: string | undefined = typeof d.rating === "string" ? d.rating : undefined;
      const id: string | undefined = typeof d.id === "string" ? d.id : undefined;
      const path: string | undefined = typeof d.path === "string" ? d.path : undefined;
      const nav: string | undefined = typeof d.nav === "string" ? d.nav : undefined;
      const viewId: string | undefined = typeof d.viewId === "string" ? d.viewId : undefined;
      const t: number | undefined = typeof d.t === "number" ? d.t : Date.now();
      const delta: number | undefined = typeof d.delta === "number" ? d.delta : undefined;
      const attribution = (() => {
        const a = d.attribution;
        if (!a || typeof a !== "object") return undefined;
        const attr = a as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        const take = (k: string, max = 512) => {
          if (!(k in attr)) return;
          const v = attr[k];
          if (typeof v === "string") out[k] = v.length > max ? v.slice(0, max) : v;
          else out[k] = v;
        };
        take("element", 512);
        take("url", 512);
        take("loadState", 64);
        take("navigationType", 32);
        take("eventTarget", 64);
        take("eventType", 32);
        take("interactionType", 32);
        take("inputDelay", 32);
        take("processingDuration", 32);
        take("presentationDelay", 32);
        take("largestShiftValue", 32);
        return Object.keys(out).length ? out : undefined;
      })();
      return { name, value, rating, id, path, nav, viewId, t, delta, attribution };
    })();

    // 丢弃非法/异常数据
    if (!cleaned.name || !ALLOWED_NAMES.has(cleaned.name)) return new Response(null, { status: 204 });
    if (typeof cleaned.value !== "number" || Number.isNaN(cleaned.value)) return new Response(null, { status: 204 });
    if (cleaned.path && cleaned.path.length > 1024) cleaned.path = cleaned.path.slice(0, 1024);

    // 上报到 Axiom
    try {
      const ua = req.headers.get("user-agent") || "";
      const country = req.headers.get("x-vercel-ip-country") || undefined;
      const region = req.headers.get("x-vercel-ip-region") || undefined;
      const city = req.headers.get("x-vercel-ip-city") || undefined;
      
      log.info("web-vitals", {
        ...cleaned,
        ua,
        geo: { country, region, city }
      });
      
      // 不阻塞响应：Node 常驻进程由 Axiom SDK 自身批量发送；
      // 若在此 await，上游外呼延迟会直接计入响应时间（sendBeacon 场景毫无收益）。
      void log.flush().catch((e) => console.error("Axiom logging error:", e));
    } catch (e) {
      console.error("Axiom logging error:", e);
    }
  } catch {}
  // 无正文 204，便于 sendBeacon 快速返回
  return new Response(null, { status: 204 });
}
