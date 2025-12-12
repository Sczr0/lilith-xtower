import { NextResponse } from 'next/server';
import { getAnnouncements } from '@/app/lib/content/parser';
import { computeWeakEtag, isEtagFresh } from '@/app/lib/utils/httpCache';

export const runtime = 'nodejs';
export const revalidate = 3600;

const CACHE_CONTROL = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

/**
 * GET /api/content/announcements
 * 获取所有启用的公告
 */
export async function GET(request: Request) {
  const ifNoneMatch = request.headers.get('if-none-match');
  try {
    const announcements = getAnnouncements();
    const body = JSON.stringify(announcements);
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
    console.error('获取公告失败:', error);
    return NextResponse.json(
      { error: '获取公告失败' },
      { status: 500 }
    );
  }
}
