import { NextResponse } from 'next/server';
import { getAllQA } from '@/app/lib/qa';
import { computeWeakEtag, isEtagFresh } from '@/app/lib/utils/httpCache';

export const runtime = 'nodejs';
export const revalidate = 3600;

const CACHE_CONTROL = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

export async function GET(request: Request) {
  const ifNoneMatch = request.headers.get('if-none-match');
  try {
    const qaData = getAllQA();
    const body = JSON.stringify(qaData);
    const etag = computeWeakEtag(body);

    if (isEtagFresh(ifNoneMatch, etag)) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': CACHE_CONTROL,
        },
      });
    }

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ETag: etag,
        'Cache-Control': CACHE_CONTROL,
      },
    });
  } catch (error) {
    console.error('Error fetching QA data:', error);
    return NextResponse.json([], { status: 500 });
  }
}
