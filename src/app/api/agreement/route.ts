import { NextResponse } from 'next/server';

import { readAgreement } from '@/app/lib/content/agreement';
import { isEtagFresh } from '@/app/lib/utils/httpCache';

export const runtime = 'nodejs';
export const revalidate = 600;

// max-age=0：法律文本更新后浏览器不得继续使用本地副本（此前浏览器缓存 1 小时会延迟新版生效）
const CACHE_CONTROL = 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400';

export async function GET(request: Request) {
  const ifNoneMatch = request.headers.get('if-none-match');
  try {
    const { content, etag } = readAgreement();
    if (isEtagFresh(ifNoneMatch, etag)) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': CACHE_CONTROL,
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        ETag: etag,
        'Cache-Control': CACHE_CONTROL,
      },
    });
  } catch (error) {
    console.error('Failed to read agreement file:', error);
    return new NextResponse('协议文件加载失败', { status: 500 });
  }
}
