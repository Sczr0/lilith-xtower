import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { computeWeakEtag, isEtagFresh } from '@/app/lib/utils/httpCache';

export const runtime = 'nodejs';
export const revalidate = 3600;

const CACHE_CONTROL = 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';

export async function GET(request: Request) {
  const ifNoneMatch = request.headers.get('if-none-match');
  try {
    const filePath = path.join(process.cwd(), 'src', 'app', 'agreement', 'agreement.md');
    const content = fs.readFileSync(filePath, 'utf8');

    const etag = computeWeakEtag(content);
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
