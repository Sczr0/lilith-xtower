import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return new Response("Bad Request", { status: 400 });
    }
    const data = await req.json();
    // 轻量处理：打印关键信息供临时观察，生产可接入日志/存储
    try {
      const { name, value, rating, path } = data || {};
      console.log(`[web-vitals] ${name}=${value} (${rating}) ${path ?? ""}`);
    } catch (_) {}
  } catch (_) {}
  // 无正文 204，便于 sendBeacon 快速返回
  return new Response(null, { status: 204 });
}

