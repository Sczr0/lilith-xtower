import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_ALLOWED_HOSTS = ['somnia.xtower.site'] as const;
const URL_MAX_LENGTH = 4096;
const TIMEOUT_MS = 15_000;

function parseAllowedHosts(): Set<string> {
  const raw = (process.env.IMAGE_PROXY_ALLOWED_HOSTS ?? '').trim();
  const hosts = raw
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  const merged = hosts.length ? hosts : Array.from(DEFAULT_ALLOWED_HOSTS);
  return new Set(merged.map((h) => h.toLowerCase()));
}

const ALLOWED_HOSTS = parseAllowedHosts();

function isImageContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return /^image\//i.test(contentType.trim());
}

function errorJson(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url');
  if (!rawUrl) return errorJson('缺少 url 参数', 400);
  if (rawUrl.length > URL_MAX_LENGTH) return errorJson('url 过长', 414);

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return errorJson('url 非法', 400);
  }

  if (target.protocol !== 'https:') {
    return errorJson('仅允许 https 协议', 400, { protocol: target.protocol });
  }

  const hostname = target.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(hostname)) {
    return errorJson('目标域名不在白名单中', 403, { hostname });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(target.toString(), {
      method: 'GET',
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent': 'PhigrosQueryImageProxy/1.0',
      },
      signal: controller.signal,
      cache: 'force-cache',
    });

    if (!upstream.ok) {
      return errorJson('上游图片请求失败', upstream.status >= 500 ? 502 : upstream.status, {
        status: upstream.status,
      });
    }

    const contentType = upstream.headers.get('content-type');
    if (!isImageContentType(contentType)) {
      return errorJson('上游返回非图片内容', 415, { contentType });
    }

    const headers = new Headers();
    headers.set('Content-Type', contentType!);
    headers.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Proxy-Upstream', hostname);

    const etag = upstream.headers.get('etag');
    if (etag) headers.set('ETag', etag);
    const lastModified = upstream.headers.get('last-modified');
    if (lastModified) headers.set('Last-Modified', lastModified);

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const isTimeout = /aborted|abort/i.test(message);
    return errorJson(isTimeout ? '图片代理请求超时' : '图片代理请求失败', isTimeout ? 504 : 502, { message });
  } finally {
    clearTimeout(timeout);
  }
}

