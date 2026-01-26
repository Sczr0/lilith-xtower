type BuildContentSecurityPolicyOptions = {
  nonce: string;
};

export function buildContentSecurityPolicy({ nonce }: BuildContentSecurityPolicyOptions) {
  return [
    "default-src 'self'",
    // 说明：移除 unsafe-inline，改用 nonce 允许 Next 运行时与必要的内联脚本执行（Next 会自动把 nonce 注入到其生成的脚本标签）
    // 增加 strict-dynamic 以防止基于 host allowlist 的 XSS 绕过（如 JSONP 攻击），并允许受信任脚本加载依赖
    `script-src 'self' 'unsafe-inline' 'nonce-${nonce}' 'strict-dynamic' https: http:`,
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