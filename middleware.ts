import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { buildContentSecurityPolicy } from './src/app/lib/security/csp';
import { AUTH_SESSION_COOKIE_NAME } from './src/app/lib/constants/cookies';

type HtmlCacheDecisionInput = {
  pathname: string;
  hasSession: boolean;
};

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
  const csp = buildContentSecurityPolicy();

  const response = NextResponse.next();

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

  if (isHtmlDocumentRequest(request)) {
    const pathname = request.nextUrl.pathname;
    const hasSession = request.cookies.get(AUTH_SESSION_COOKIE_NAME) !== undefined;
    response.headers.set('Cache-Control', decideHtmlCacheControl({ pathname, hasSession }));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
