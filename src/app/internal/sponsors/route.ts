import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { computeWeakEtag, isEtagFresh } from '@/app/lib/utils/httpCache';

export const runtime = 'nodejs';
export const revalidate = 300;

const CACHE_CONTROL_OK = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
const CACHE_CONTROL_ERR = 'no-store';

// 生成签名：md5(token + kv_string)
function md5(input: string) {
  return crypto.createHash('md5').update(input).digest('hex');
}

export async function GET(request: Request) {
  const ifNoneMatch = request.headers.get('if-none-match');
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get('per_page') ?? '12')));
  const filterUserIds = url.searchParams.get('user_id') || undefined; // 可选的过滤

  const AFDIAN_USER_ID = process.env.AFDIAN_USER_ID;
  const AFDIAN_TOKEN = process.env.AFDIAN_TOKEN;

  if (!AFDIAN_USER_ID || !AFDIAN_TOKEN) {
    return NextResponse.json({
      ec: 503,
      em: 'Server config missing: set AFDIAN_USER_ID and AFDIAN_TOKEN in env',
    }, {
      status: 503,
      headers: {
        'Cache-Control': CACHE_CONTROL_ERR,
      },
    });
  }

  const ts = Math.floor(Date.now() / 1000);
  const paramsObj: Record<string, unknown> = { page, per_page: perPage };
  if (filterUserIds) paramsObj.user_id = filterUserIds;
  const paramsStr = JSON.stringify(paramsObj);

  const kvString = `params${paramsStr}ts${ts}user_id${AFDIAN_USER_ID}`;
  const sign = md5(`${AFDIAN_TOKEN}${kvString}`);

  try {
    const res = await fetch('https://afdian.com/api/open/query-sponsor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: AFDIAN_USER_ID,
        params: paramsStr,
        ts,
        sign,
      }),
      cache: 'no-store',
    });

    const data = await res.json();
    // 直接透传 AFDian 返回结构，前端按 data.list 渲染
    if (!res.ok) {
      return NextResponse.json(data, {
        status: res.status,
        headers: {
          'Cache-Control': CACHE_CONTROL_ERR,
        },
      });
    }

    const body = JSON.stringify(data);
    const etag = computeWeakEtag(body);

    if (isEtagFresh(ifNoneMatch, etag)) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': CACHE_CONTROL_OK,
          'Content-Type': 'application/json; charset=utf-8',
        },
      });
    }

    return new NextResponse(body, {
      status: res.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ETag: etag,
        'Cache-Control': CACHE_CONTROL_OK,
      },
    });
  } catch (e) {
    return NextResponse.json({ ec: 500, em: 'fetch sponsors failed', err: String(e) }, {
      status: 500,
      headers: {
        'Cache-Control': CACHE_CONTROL_ERR,
      },
    });
  }
}
