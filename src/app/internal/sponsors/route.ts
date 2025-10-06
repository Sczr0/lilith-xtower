import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

// 生成签名：md5(token + kv_string)
function md5(input: string) {
  return crypto.createHash('md5').update(input).digest('hex');
}

export async function GET(request: Request) {
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
    }, { status: 503 });
  }

  const ts = Math.floor(Date.now() / 1000);
  const paramsObj: Record<string, any> = { page, per_page: perPage };
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
      // @ts-ignore — 允许外部调用
      cache: 'no-store',
    });

    const data = await res.json();
    // 直接透传 AFDian 返回结构，前端按 data.list 渲染
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ ec: 500, em: 'fetch sponsors failed', err: String(e) }, { status: 500 });
  }
}
