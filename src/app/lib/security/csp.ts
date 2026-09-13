export function buildContentSecurityPolicy() {
  // 如果自托管 widget JS 到站点 /public，则无需 CDN 域名
  const capCdn = process.env.CAP_WIDGET_CDN === 'false' ? '' : 'https://cdn.jsdelivr.net';
  // 通配符覆盖所有自有子域和阿里云 CDN 子域
  const wildcards = 'https://*.xtower.site https://*.myalicdn.com';
  // 阿里云 ESA 注入的 RUM 拨测脚本（rum_common.js）会 fetch
  // https://rumprbjs-sp.ialicdn.com/target*/test*.jpg 做网络质量拨测。注意拨测域名是
  // *.ialicdn.com，与上报用的 *.myalicdn.com 不同域（少了 my 前缀），所以没有被上面的
  // wildcards 覆盖，会被 connect-src 拦下并产生 unhandledrejection（详见
  // lib/utils/thirdPartyRumNoise.ts）。这里仅放行 connect-src，不并入 wildcards，
  // 避免顺带放开脚本/样式/字体/图片来源。
  const esaRumProbe = 'https://*.ialicdn.com';

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cloud.umami.is ${wildcards} ${capCdn}`.trim(),
    `script-src-elem 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cloud.umami.is ${wildcards} ${capCdn}`.trim(),
    `worker-src 'self' blob:`,
    `connect-src 'self' https://cloud.umami.is https://cloudflareinsights.com https://api-gateway.umami.dev https://api.umami.is https://accounts.tapapis.com https://accounts.tapapis.cn https://afdian.com https://pic1.afdiancdn.com ${wildcards} ${esaRumProbe} ${capCdn}`.trim(),
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
