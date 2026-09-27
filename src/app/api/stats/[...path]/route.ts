import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM_BASE = (process.env.UNIFIED_API_BASE_URL || 'https://seekend.xtower.site').replace(/\/+$/, '');

const TIMEOUT_MS = 15_000;

/**
 * 缓存策略（按响应状态区分）：
 * - 成功：交给 CDN 缓存 60s（s-maxage），保护 2H2G 源站；不带 max-age，浏览器不缓存。
 * - 失败：绝不缓存，上游一恢复用户即刻恢复。
 *
 * 背景：此前由 next.config.ts 的 /api/stats/:path* 规则统一下发 public 60s，
 * 会把上游 5xx 一起缓存 60s（实测 Next 的 config headers 会覆盖路由设置的头）。
 * 现已移除该规则，改由本路由按状态自行下发。
 */
const SUCCESS_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=30';
const ERROR_CACHE_CONTROL = 'no-store, no-cache';

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const safePath = path.filter(Boolean).map(encodeURIComponent).join('/');
  const upstream = `${UPSTREAM_BASE}/api/v1/stats/${safePath}${req.nextUrl.search}`;

  try {
    const res = await fetch(upstream, {
      method: 'GET',
      headers: {
        Accept: req.headers.get('accept') || 'application/json',
        'X-Forwarded-By': 'PhigrosQuery',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });

    // 先在 handler 内读完 body：AbortSignal.timeout 会覆盖到读取结束，上游超时/中断
    // 一定落进下面的 catch，返回干净的 504。若直接透传 res.body，超时发生在 handler
    // 返回之后、catch 接不住，Next 只会记 "failed to pipe response"，客户端拿到的是
    // 中断的响应（LILITH-XTOWER-Z）。统计响应体很小，缓冲不带来内存压力。
    const body = await res.arrayBuffer();

    const isSuccess = res.status >= 200 && res.status < 300;
    return new NextResponse(body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': isSuccess ? SUCCESS_CACHE_CONTROL : ERROR_CACHE_CONTROL,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const isTimeout = /aborted|abort/i.test(message);
    return NextResponse.json(
      { error: isTimeout ? '统计API请求超时，请稍后重试' : `统计API请求失败：${message}` },
      { status: isTimeout ? 504 : 502, headers: { 'Cache-Control': ERROR_CACHE_CONTROL } },
    );
  }
}
