import { NextResponse } from 'next/server';
import { computeWeakEtag, isEtagFresh } from '@/app/lib/utils/httpCache';
import { fetchAfdianSponsorsCached } from '@/app/lib/sponsors/afdian';

export const runtime = 'nodejs';
export const revalidate = 300;

const CACHE_CONTROL_OK = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
const CACHE_CONTROL_ERR = 'no-store';

export async function GET(request: Request) {
  const ifNoneMatch = request.headers.get('if-none-match');
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get('per_page') ?? '12')));
  const filterUserIds = url.searchParams.get('user_id') || undefined; // 可选的过滤

  try {
    const result = await fetchAfdianSponsorsCached(page, perPage, filterUserIds);
    if (!result.ok) {
      return NextResponse.json(result.payload, {
        status: result.status,
        headers: {
          'Cache-Control': CACHE_CONTROL_ERR,
        },
      });
    }

    const body = JSON.stringify(result.payload);
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
      status: result.status,
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
