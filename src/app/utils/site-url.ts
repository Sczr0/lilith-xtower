const DEFAULT_SITE_URL = 'https://lilith.xtower.site'

/**
 * 获取站点完整域名，兼容预览环境与无协议写法。
 */
export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const vercelUrl = process.env.VERCEL_URL?.trim()

  let url = envUrl || (vercelUrl ? `https://${vercelUrl}` : DEFAULT_SITE_URL)

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`
  }

  try {
    return new URL(url).origin
  } catch {
    return DEFAULT_SITE_URL
  }
}

export const SITE_URL = getSiteUrl()
