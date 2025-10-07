import type { MetadataRoute } from 'next'

const RAW = process.env.NEXT_PUBLIC_SITE_URL
const SITE_URL = RAW
  ? (RAW.startsWith('http://') || RAW.startsWith('https://') ? RAW : `https://${RAW}`)
  : 'https://lilith.xtower.site'

const staticRoutes = [
  '/',
  '/about',
  '/agreement',
  '/dashboard',
  '/debug-auth',
  '/demo/score-card',
  '/login',
  '/qa',
  '/sponsors',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return staticRoutes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: path === '/' ? 1 : 0.6,
  }))
}
