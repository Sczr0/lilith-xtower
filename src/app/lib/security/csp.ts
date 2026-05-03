export function buildContentSecurityPolicy() {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cloud.umami.is",
    "connect-src 'self' https://cloud.umami.is https://cloudflareinsights.com https://api-gateway.umami.dev https://api.umami.is https://seekend.xtower.site https://accounts.tapapis.com https://accounts.tapapis.cn https://afdian.com https://pic1.afdiancdn.com https://somnia.xtower.site https://rjsperf.myalicdn.com",
    "style-src-elem 'self' 'unsafe-inline' https://somnia.xtower.site https://r-0semi.xtower.site",
    "style-src 'self' 'unsafe-inline' https://somnia.xtower.site https://r-0semi.xtower.site",
    "img-src 'self' data: blob: https://accounts.tapapis.com https://accounts.tapapis.cn https://accounts.taptap.io https://accounts.taptap.cn https://pic1.afdiancdn.com https://somnia.xtower.site https://r-0semi.xtower.site",
    "font-src 'self' https://somnia.xtower.site https://r-0semi.xtower.site",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
