export function buildContentSecurityPolicy() {
  // 如果自托管 widget JS 到站点 /public，则无需 CDN 域名
  const capCdn = process.env.CAP_WIDGET_CDN === 'false' ? '' : 'https://cdn.jsdelivr.net';
  // 通配符覆盖所有自有子域和阿里云 CDN 子域
  const wildcards = 'https://*.xtower.site https://*.myalicdn.com';

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cloud.umami.is ${wildcards} ${capCdn}`.trim(),
    `script-src-elem 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cloud.umami.is ${wildcards} ${capCdn}`.trim(),
    `worker-src 'self' blob:`,
    `connect-src 'self' https://cloud.umami.is https://cloudflareinsights.com https://api-gateway.umami.dev https://api.umami.is https://accounts.tapapis.com https://accounts.tapapis.cn https://afdian.com https://pic1.afdiancdn.com ${wildcards} ${capCdn}`.trim(),
    `style-src-elem 'self' 'unsafe-inline' ${wildcards}`.trim(),
    `style-src 'self' 'unsafe-inline' ${wildcards}`.trim(),
    `img-src 'self' data: blob: https://accounts.tapapis.com https://accounts.tapapis.cn https://accounts.taptap.io https://accounts.taptap.cn https://pic1.afdiancdn.com ${wildcards}`.trim(),
    `font-src 'self' ${wildcards}`.trim(),
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
