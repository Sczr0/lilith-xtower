import { NextResponse } from 'next/server';

const TAPTAP_URL = 'https://www.taptap.io/';
const BLOCK_PHRASE = '不在中国大陆地区提供服务';
const DEFAULT_TIMEOUT_MS = 5000;

// 基于返回的 HTML 判断是否为国际版：缺少封禁提示即视为国际版
const detectFromHtml = (html: string) => {
  const containsBlockPhrase = html.includes(BLOCK_PHRASE);
  return {
    isInternational: !containsBlockPhrase,
    containsBlockPhrase,
  };
};

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(TAPTAP_URL, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      // 附带 UA 方便服务端区分来源，减少被限流概率
      headers: {
        'User-Agent': 'PhigrosQuery/1.0 (TapTap region probe)',
      },
      signal: controller.signal,
    });

    const html = await response.text();
    const { isInternational, containsBlockPhrase } = detectFromHtml(html);

    return NextResponse.json(
      {
        isInternational,
        containsBlockPhrase,
        source: TAPTAP_URL,
        status: response.status,
        checkedAt,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return NextResponse.json(
      {
        isInternational: false,
        containsBlockPhrase: false,
        source: TAPTAP_URL,
        checkedAt,
        error: message,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } finally {
    clearTimeout(timeout);
  }
}
