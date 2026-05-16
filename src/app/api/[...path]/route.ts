import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM_BASE = (process.env.UNIFIED_API_BASE_URL || 'https://seekend.xtower.site').replace(/\/+$/, '');

const TIMEOUT_MS = 15_000;

type RouteContext = { params: Promise<{ path: string[] }> };

function buildUpstream(pathParts: string[], search: string) {
  const safe = pathParts.filter(Boolean).map(encodeURIComponent).join('/');
  const url = new URL(`${UPSTREAM_BASE}/api/v1/${safe}`);
  url.search = search;
  return url;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  return proxy(req, await ctx.params);
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  return proxy(req, await ctx.params);
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  return proxy(req, await ctx.params);
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  return proxy(req, await ctx.params);
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  return proxy(req, await ctx.params);
}

async function proxy(req: NextRequest, params: { path: string[] }) {
  const upstream = buildUpstream(params.path, req.nextUrl.search);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      Accept: req.headers.get('accept') || 'application/json',
      'Content-Type': req.headers.get('content-type') || 'application/json',
      'X-Forwarded-By': 'PhigrosQuery',
    };

    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text().catch(() => undefined);

    const res = await fetch(upstream.toString(), {
      method: req.method,
      headers,
      body,
      signal: controller.signal,
      cache: 'no-store',
    });

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const isTimeout = /aborted|abort/i.test(message);
    return NextResponse.json(
      { error: isTimeout ? 'API 请求超时，请稍后重试' : `API 请求失败：${message}` },
      { status: isTimeout ? 504 : 502, headers: { 'Cache-Control': 'no-store' } },
    );
  } finally {
    clearTimeout(timeout);
  }
}
