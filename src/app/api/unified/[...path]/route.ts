import { NextRequest, NextResponse } from 'next/server';

// 需要服务端代理以绕过浏览器 CORS/CSP，并避免在客户端直连第三方域名
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_BASE_URL = 'https://phib19.top:8080';
const UPSTREAM_BASE_URL = (process.env.UNIFIED_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
const TIMEOUT_MS = 15_000;

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToUnifiedApi(req, path);
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToUnifiedApi(req, path);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToUnifiedApi(req, path);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToUnifiedApi(req, path);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToUnifiedApi(req, path);
}

function buildUpstreamUrl(pathParts: string[], search: string) {
  const safeParts = pathParts
    .filter((p) => typeof p === 'string' && p.length > 0)
    .map((p) => p.replace(/^\//, ''))
    .map(encodeURIComponent);
  const upstream = new URL(`${UPSTREAM_BASE_URL}/${safeParts.join('/')}`);
  upstream.search = search;
  return upstream;
}

async function proxyToUnifiedApi(req: NextRequest, pathParts: string[]) {
  const upstream = buildUpstreamUrl(pathParts, req.nextUrl.search);
  const method = req.method.toUpperCase();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const contentType = req.headers.get('content-type') || 'application/json';
    const accept = req.headers.get('accept') || 'application/json';

    const headers: Record<string, string> = {
      Accept: accept,
      'Content-Type': contentType,
      // 标记为站点代理请求，便于上游排查
      'X-Forwarded-By': 'PhigrosQuery',
    };

    const body =
      method === 'GET' || method === 'HEAD'
        ? undefined
        : await req.text().catch(() => undefined);

    const res = await fetch(upstream.toString(), {
      method,
      headers,
      body,
      signal: controller.signal,
      cache: 'no-store',
    });

    const resContentType = res.headers.get('content-type') || 'application/json; charset=utf-8';
    const text = await res.text();

    return new NextResponse(text, {
      status: res.status,
      headers: {
        'Content-Type': resContentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const isTimeout = /aborted|abort/i.test(message);
    return NextResponse.json(
      { error: isTimeout ? '联合API请求超时，请稍后重试' : `联合API请求失败：${message}` },
      { status: isTimeout ? 504 : 502, headers: { 'Cache-Control': 'no-store' } },
    );
  } finally {
    clearTimeout(timeout);
  }
}

