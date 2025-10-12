import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const up = new URL('https://seekend.xtower.site/api/v1/stats/summary');
    const curr = new URL(req.url);
    // 预留时间范围/过滤参数的透传
    curr.searchParams.forEach((value, key) => up.searchParams.set(key, value));

    const res = await fetch(up.toString(), {
      method: 'GET',
      // 不带鉴权头；由服务端发起，无浏览器 CORS 限制
      // 可在未来根据 query 透传时间范围参数（预留）
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ message: 'Upstream fetch failed' }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Proxy error', error: (error as Error).message }, { status: 502 });
  }
}
