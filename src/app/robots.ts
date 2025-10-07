import type { MetadataRoute } from 'next'

const RAW = process.env.NEXT_PUBLIC_SITE_URL
const SITE_URL = RAW
  ? (RAW.startsWith('http://') || RAW.startsWith('https://') ? RAW : `https://${RAW}`)
  : 'https://lilith.xtower.site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api', '/internal'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
