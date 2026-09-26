import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { buildContentSecurityPolicy } from './src/app/lib/security/csp';
import { AUTH_SESSION_COOKIE_NAME } from './src/app/lib/constants/cookies';

type HtmlCacheDecisionInput = {
  pathname: string;
  hasSession: boolean;
};

/**
 * CSP 是进程内静态值（只依赖环境变量，运行期不变）：
 * 模块加载时计算一次，避免每个请求重复拼字符串与分配。
 */
const CONTENT_SECURITY_POLICY = buildContentSecurityPolicy();

const PUBLIC_HTML_CACHE: Record<string, string> = {
  '/': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
  '/about': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
  '/sponsors': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
  '/contribute': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
  '/songs': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
  // 匿名访客高频入口：登录页为纯静态壳（个性化全部在客户端）
  '/login': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
  '/open-platform': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
  // 与 /agreement 同性质的签名法律文档页（构建期内容哈希产物，适合更长 CDN 缓存）
  '/open-platform/agreement': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
  '/qa': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
  '/agreement': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
  '/privacy': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
  // 纯静态壳 + 客户端状态：/verify 是本地校验工具，/banned 的封禁详情由客户端从
  // sessionStorage 回填，两者匿名共享同一份 HTML 是安全的（带会话 Cookie 仍走 no-store）
  '/verify': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
  '/banned': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
};

function isHtmlDocumentRequest(request: NextRequest): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;

  const accept = request.headers.get('accept') || '';
  if (!accept.includes('text/html')) return false;

  const pathname = request.nextUrl.pathname;
  if (pathname.includes('.')) return false;

  return true;
}

export function decideHtmlCacheControl(input: HtmlCacheDecisionInput): string {
  if (input.hasSession) return 'private, no-store, max-age=0';
  return PUBLIC_HTML_CACHE[input.pathname] ?? 'private, no-store, max-age=0';
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-site');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set(
    'Permissions-Policy',
    'accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  );
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (isHtmlDocumentRequest(request)) {
    const pathname = request.nextUrl.pathname;
    const hasSession = request.cookies.get(AUTH_SESSION_COOKIE_NAME) !== undefined;
    response.headers.set('Cache-Control', decideHtmlCacheControl({ pathname, hasSession }));
  }

  return response;
}

export const config = {
  /**
   * 只让「可能返回 HTML 文档」的请求走中间件，排除以下几类：
   *
   * - `api`：只返回 JSON / 图片 / 303 重定向，从不返回 HTML
   *   （唯一带 HTML 分支的 api/debug-auth/authorize 也只是重定向）。JSON 上加 CSP 无意义，
   *   而真正需要 nosniff 的图片路由（image/bn、image/song、proxy/image）都已自行设置该头。
   * - `monitoring`：Sentry 隧道。Next 官方明确要求 tunnelRoute 不得与中间件 matcher 冲突，
   *   否则客户端错误上报会失败（见 next.config.ts 的 tunnelRoute 说明）。
   * - `_next/static`、`_next/image`：构建产物（原本已排除）。
   * - `fonts`、`icons`、`precompiled`：静态资源；其中 precompiled/*.html 为内容哈希产物，
   *   仅由服务端读取后注入，不作为文档导航。
   * - `sw.js`、`manifest.webmanifest`、`favicon.ico`、`robots.txt`、`sitemap.xml`：非文档资源。
   *
   * 注意：
   * - offline.html 是真正的文档（可能被直接访问），因此**不**排除，仍需安全头。
   * - 目录型命名空间一律带 `/` 边界（api/、fonts/ 等），避免误伤 /apiary、/fontsize
   *   这类未来可能出现的页面路由；monitoring 用 (?:/|$) 是因为 Sentry 隧道就是裸 /monitoring。
   */
  matcher: [
    '/((?!api/|monitoring(?:/|$)|_next/static|_next/image|fonts/|icons/|precompiled/|sw\\.js|manifest\\.webmanifest|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)',
  ],
};
