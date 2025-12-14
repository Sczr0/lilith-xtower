import { NextRequest } from 'next/server';

const ALLOWED_HOSTS = new Set<string>([
  // BestN SVG 里的封面图常用来源
  'somnia.xtower.site',
]);

function isAllowedUpstream(url: URL): boolean {
  if (url.protocol !== 'https:') return false;
  return ALLOWED_HOSTS.has(url.hostname);
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url');
  if (!raw) {
    return Response.json({ message: 'missing url' }, { status: 400 });
  }

  let upstream: URL;
  try {
    upstream = new URL(raw);
  } catch {
    return Response.json({ message: 'invalid url' }, { status: 400 });
  }

  if (!isAllowedUpstream(upstream)) {
    return Response.json({ message: 'url not allowed' }, { status: 400 });
  }

  try {
    const res = await fetch(upstream.toString(), {
      method: 'GET',
      // 仅做资源转发，不携带任何凭证
      cache: 'no-store',
    });

    if (!res.ok) {
      return Response.json({ message: `upstream error: ${res.status}` }, { status: 502 });
    }

    const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
    const body = await res.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // 让浏览器以内联方式处理图片资源
        'Content-Disposition': 'inline',
        // next.config.ts 对 /api/:path* 默认 no-store，这里显式设置也保持一致
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return Response.json({ message: 'upstream fetch failed' }, { status: 502 });
  }
}

