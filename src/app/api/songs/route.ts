import { NextResponse } from 'next/server';
import { getSongInfoData } from '@/app/lib/info/songInfo';
import { computeWeakEtag, isEtagFresh } from '@/app/lib/utils/httpCache';

export const runtime = 'nodejs';
export const revalidate = 3600;

const CACHE_CONTROL = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

/**
 * GET /api/songs
 * 曲目信息（定数表数据源）：版本号 + 全量曲目（含曲师/画师/各难度定数）。
 * 数据来自 somnia.xtower.site/info（服务端代理 + 缓存），对站点公开。
 */
export async function GET(request: Request) {
  const ifNoneMatch = request.headers.get('if-none-match');
  try {
    const data = await getSongInfoData();
    const body = JSON.stringify(data);
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
    console.error('获取曲目信息失败:', error);
    return NextResponse.json(
      { error: '曲目信息暂不可用，请稍后重试' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
