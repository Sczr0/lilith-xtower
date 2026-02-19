type BuildContentSecurityPolicyOptions = {
  nonce: string;
};

export function buildContentSecurityPolicy({ nonce }: BuildContentSecurityPolicyOptions) {
  return [
    "default-src 'self'",
    // 说明：脚本执行仅允许本站 + 指定第三方域名，并强制要求 nonce，避免协议级放开（https:/http:）导致策略过宽。
    `script-src 'self' 'nonce-${nonce}' https://cloud.umami.is`,
    "connect-src 'self' https://cloud.umami.is https://cloudflareinsights.com https://api-gateway.umami.dev https://api.umami.is https://seekend.xtower.site https://accounts.tapapis.com https://accounts.tapapis.cn https://afdian.com https://pic1.afdiancdn.com https://somnia.xtower.site https://rjsperf.myalicdn.com",
    // 说明：项目内存在多处动态 style 属性/第三方库依赖，暂保留 unsafe-inline；后续可考虑按 `style-src-attr`/`style-src-elem` 拆分收敛
    "style-src-elem 'self' 'unsafe-inline' https://somnia.xtower.site",
    "style-src 'self' 'unsafe-inline' https://somnia.xtower.site",
    "img-src 'self' data: blob: https://accounts.tapapis.com https://accounts.tapapis.cn https://accounts.taptap.io https://accounts.taptap.cn https://pic1.afdiancdn.com https://somnia.xtower.site",
    "font-src 'self' https://somnia.xtower.site",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
