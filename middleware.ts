import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { buildContentSecurityPolicy } from './src/app/lib/security/csp';
import { AUTH_SESSION_COOKIE_NAME } from './src/app/lib/constants/cookies';

type HtmlCacheDecisionInput = {
  pathname: string;
  hasSession: boolean;
};

// 说明：仅对白名单公共页面启用共享缓存；其他 HTML 默认 private/no-store。
// 若存在登录会话 cookie，则无论路径是否在白名单，都强制 private/no-store，避免未来引入“按 Cookie/Headers 个性化渲染”时发生误缓存。
const PUBLIC_HTML_CACHE: Record<string, string> = {
  '/': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
  '/about': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
  '/sponsors': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
  '/contribute': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
  '/qa': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
  '/agreement': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
  '/privacy': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
};

function isHtmlDocumentRequest(request: NextRequest): boolean {
  // 说明：仅处理“页面导航”的 HTML 请求，避免影响 API/静态资源等其它响应。
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;

  const accept = request.headers.get('accept') || '';
  if (!accept.includes('text/html')) return false;

  // 说明：带扩展名的请求通常是静态资源（如 /robots.txt、/precompiled/*.html、/fonts/*），避免覆盖它们的缓存策略。
  const pathname = request.nextUrl.pathname;
  if (pathname.includes('.')) return false;

  return true;
}

export function decideHtmlCacheControl(input: HtmlCacheDecisionInput): string {
  if (input.hasSession) return 'private, no-store, max-age=0';
  return PUBLIC_HTML_CACHE[input.pathname] ?? 'private, no-store, max-age=0';
}

function createNonce() {
  // 说明：Next 会从请求头 `content-security-policy` 中解析 `script-src 'nonce-...'`，并自动注入到其生成的脚本/样式资源标签。
  // 这里使用 UUID 作为 nonce 值（不包含 HTML 转义字符），满足 Next 的 nonce 校验约束。
  return crypto.randomUUID();
}

export function middleware(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildContentSecurityPolicy({ nonce });

  const requestHeaders = new Headers(request.headers);
  // 关键：写入 request header，让 Next 在渲染阶段拿到 nonce 并注入到内联脚本。
  // 注意：如果页面被静态化（SSG），HTML 不会随请求重渲染，nonce 也无法动态注入，会被 CSP 阻止导致白屏。
  // 本项目在 `src/app/layout.tsx` 通过 `dynamic = 'force-dynamic'` 强制按请求渲染以保证 nonce 可用。
  requestHeaders.set('content-security-policy', csp);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-site');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set(
    'Permissions-Policy',
    'accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  );
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 说明：HTML 缓存策略放在 middleware 内统一决策，避免 next.config.ts 只能“按路径静态匹配”而无法识别登录态。
  if (isHtmlDocumentRequest(request)) {
    const pathname = request.nextUrl.pathname;
    const hasSession = request.cookies.get(AUTH_SESSION_COOKIE_NAME) !== undefined;
    response.headers.set('Cache-Control', decideHtmlCacheControl({ pathname, hasSession }));
  }

  return response;
}

export const config = {
  // 静态资源不需要 CSP，减少 middleware 开销
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
