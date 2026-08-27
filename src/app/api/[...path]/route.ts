import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM_BASE = (process.env.UNIFIED_API_BASE_URL || 'https://seekend.xtower.site').replace(/\/+$/, '');

const TIMEOUT_MS = 15_000;

/**
 * 代理路径前缀白名单（纵深防御）：
 * 仅转发本站前端明确依赖的上游前缀，未列入的 /api/* 一律 404，
 * 避免 catch-all 路由成为上游任意端点的公开代理面。
 * 可通过环境变量 API_PROXY_ALLOWED_PREFIXES 扩展（逗号分隔）。
 */
const DEFAULT_ALLOWED_PREFIXES = ['auth', 'developer', 'leaderboard', 'public', 'image', 'songs'] as const;

function parseAllowedPrefixes(): Set<string> {
  const raw = (process.env.API_PROXY_ALLOWED_PREFIXES ?? '').trim();
  const prefixes = raw
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const merged = prefixes.length ? prefixes : Array.from(DEFAULT_ALLOWED_PREFIXES);
  return new Set(merged);
}

const ALLOWED_PREFIXES = parseAllowedPrefixes();

type RouteContext = { params: Promise<{ path: string[] }> };

function buildUpstream(pathParts: string[], search: string) {
  const safe = pathParts.filter(Boolean).map(encodeURIComponent).join('/');
  const url = new URL(`${UPSTREAM_BASE}/api/v1/${safe}`);
  url.search = search;
  return url;
}

function isAllowedProxyPath(pathParts: string[]): boolean {
  const first = pathParts[0]?.toLowerCase() ?? '';
  return ALLOWED_PREFIXES.has(first);
}

function notFound() {
  return NextResponse.json(
    { error: 'Not Found' },
    { status: 404, headers: { 'Cache-Control': 'private, no-store' } },
  );
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
  if (!isAllowedProxyPath(params.path)) {
    return notFound();
  }

  const upstream = buildUpstream(params.path, req.nextUrl.search);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      Accept: req.headers.get('accept') || 'application/json',
      'X-Forwarded-By': 'PhigrosQuery',
    };

    const contentType = req.headers.get('content-type');
    if (contentType) headers['Content-Type'] = contentType;

    const cookie = req.headers.get('cookie');
    if (cookie) headers.Cookie = cookie;

    const userAgent = req.headers.get('user-agent');
    if (userAgent) headers['User-Agent'] = userAgent;

    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text().catch(() => undefined);

    const res = await fetch(upstream.toString(), {
      method: req.method,
      headers,
      body,
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'manual',
    });

    const responseHeaders = new Headers({
      'Content-Type': res.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      Vary: 'Cookie, Authorization',
    });

    const location = res.headers.get('location');
    if (location) responseHeaders.set('Location', location);

    const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const value of setCookies) {
      responseHeaders.append('Set-Cookie', value);
    }

    if (res.status >= 300 && res.status < 400) {
      return new NextResponse(null, { status: res.status, headers: responseHeaders });
    }

    const text = await res.text();
    return new NextResponse(text, { status: res.status, headers: responseHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const isTimeout = /aborted|abort/i.test(message);
    return NextResponse.json(
      { error: isTimeout ? 'API 请求超时，请稍后重试' : `API 请求失败：${message}` },
      {
        status: isTimeout ? 504 : 502,
        headers: {
          'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
          Vary: 'Cookie, Authorization',
        },
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}
