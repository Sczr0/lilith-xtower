import { NextRequest, NextResponse } from 'next/server';

import { computeWeakEtag, isEtagFresh } from '@/app/lib/utils/httpCache';
import { filterOutSiteOwnedCookies, sanitizeUpstreamSetCookie } from '@/app/lib/utils/proxyCookies';
import { SITE_OWNED_COOKIE_NAMES } from '@/app/lib/constants/cookies';
import {
  matchPublicGetCache,
  UpstreamPassthroughError,
  type PublicProxyCacheInstance,
  type PublicProxyCacheRule,
} from '@/app/lib/api/publicProxyCache';

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

  // 公开只读 GET（排行榜 Top/按名次、公开档案、歌曲搜索）：
  // 源站内存缓存 + ETag/304 + 公开 Cache-Control；不转发 Cookie、不带 Vary。
  const publicGet = matchPublicGetCache(req.method, params.path);
  if (publicGet) {
    return proxyPublicGet(req, params.path, publicGet.rule, publicGet.cache);
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

    // 安全：剔除站内自有 Cookie（会话/debug 放行等）后再转发，
    // 其余 Cookie（上游经由本站中转的会话）原样保留
    const cookie = req.headers.get('cookie');
    const forwardCookie = cookie ? filterOutSiteOwnedCookies(cookie, SITE_OWNED_COOKIE_NAMES) : '';
    if (forwardCookie) headers.Cookie = forwardCookie;

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
      // 安全：上游 Set-Cookie 落在本站域 —— 丢弃与站内 Cookie 同名的项（防覆盖
      // 会话状态），剥离 Domain 属性（收窄为 host-only），其余原样透传
      const sanitized = sanitizeUpstreamSetCookie(value, SITE_OWNED_COOKIE_NAMES);
      if (sanitized) responseHeaders.append('Set-Cookie', sanitized);
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

/** 缓存 key 对查询参数排序归一，避免同义不同序的参数产生重复条目 */
function buildPublicCacheKey(pathname: string, search: string): string {
  if (!search) return pathname;
  const params = new URLSearchParams(search);
  params.sort();
  return `${pathname}?${params.toString()}`;
}

async function proxyPublicGet(
  req: NextRequest,
  pathParts: string[],
  rule: PublicProxyCacheRule,
  cache: PublicProxyCacheInstance,
): Promise<NextResponse> {
  const upstream = buildUpstream(pathParts, req.nextUrl.search);
  const cacheKey = buildPublicCacheKey(req.nextUrl.pathname, req.nextUrl.search);
  const NO_STORE = 'private, no-store, no-cache, max-age=0, must-revalidate';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const entry = await cache.get(cacheKey, async () => {
      // 匿名请求：不带 Cookie/Authorization，上游返回的是公开视图，可安全共享缓存
      const res = await fetch(upstream.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Forwarded-By': 'PhigrosQuery',
        },
        signal: controller.signal,
        cache: 'no-store',
      });

      const contentType = res.headers.get('content-type') || 'application/json; charset=utf-8';
      const text = await res.text();

      if (!res.ok) {
        // 非 2xx 不缓存，原样透传状态码与响应体
        throw new UpstreamPassthroughError(res.status, contentType, text);
      }

      return { status: res.status, contentType, body: text, etag: computeWeakEtag(text) };
    });

    const cacheControl = rule.cacheControl || NO_STORE;

    if (isEtagFresh(req.headers.get('if-none-match'), entry.etag)) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: entry.etag, 'Cache-Control': cacheControl },
      });
    }

    return new NextResponse(entry.body, {
      status: entry.status,
      headers: {
        'Content-Type': entry.contentType,
        'Cache-Control': cacheControl,
        ETag: entry.etag,
      },
    });
  } catch (err) {
    if (err instanceof UpstreamPassthroughError) {
      return new NextResponse(err.body, {
        status: err.status,
        headers: { 'Content-Type': err.contentType, 'Cache-Control': NO_STORE },
      });
    }

    const message = err instanceof Error ? err.message : 'Unknown error';
    const isTimeout = /aborted|abort/i.test(message);
    return NextResponse.json(
      { error: isTimeout ? 'API 请求超时，请稍后重试' : `API 请求失败：${message}` },
      {
        status: isTimeout ? 504 : 502,
        headers: { 'Cache-Control': NO_STORE, Pragma: 'no-cache', Expires: '0' },
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}
