import { NextRequest } from "next/server";
import { Logger } from 'next-axiom';

export const runtime = "nodejs";

const ALLOWED_NAMES = new Set(["LCP", "CLS", "INP", "TTFB", "FCP", "FID"]);

export async function POST(req: NextRequest) {
  const log = new Logger();

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
      
      // 必须 flush 才能确保数据发出
      await log.flush();
    } catch (e) {
      console.error("Axiom logging error:", e);
    }
  } catch {}
  // 无正文 204，便于 sendBeacon 快速返回
  return new Response(null, { status: 204 });
}
