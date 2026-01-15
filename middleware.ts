import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { buildContentSecurityPolicy } from './src/app/lib/security/csp';

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

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  // 静态资源不需要 CSP，减少 middleware 开销
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
