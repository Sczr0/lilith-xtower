import type { MetadataRoute } from 'next'
import fs from 'fs'
import path from 'path'
import { SITE_URL } from './utils/site-url'

type RouteConfig = {
  path: string
  priority: number
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  source: string
}

const routeConfigs: RouteConfig[] = [
  { path: '/', priority: 1.0, changeFrequency: 'weekly', source: 'src/app/page.tsx' },
  { path: '/login', priority: 0.9, changeFrequency: 'monthly', source: 'src/app/login/page.tsx' },
  { path: '/dashboard', priority: 0.8, changeFrequency: 'weekly', source: 'src/app/dashboard/page.tsx' },
  { path: '/qa', priority: 0.7, changeFrequency: 'weekly', source: 'src/app/qa/page.tsx' },
  { path: '/about', priority: 0.6, changeFrequency: 'monthly', source: 'src/app/about/page.tsx' },
  { path: '/sponsors', priority: 0.5, changeFrequency: 'monthly', source: 'src/app/sponsors/page.tsx' },
  { path: '/agreement', priority: 0.3, changeFrequency: 'yearly', source: 'src/app/agreement/page.tsx' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly', source: 'src/app/privacy/page.tsx' },
  { path: '/contribute', priority: 0.4, changeFrequency: 'monthly', source: 'src/app/contribute/page.tsx' },
  { path: '/demo/score-card', priority: 0.2, changeFrequency: 'monthly', source: 'src/app/demo/score-card/page.tsx' },
  { path: '/demo/bestn-svg', priority: 0.2, changeFrequency: 'monthly', source: 'src/app/demo/bestn-svg/page.tsx' },
]

function getLastModified(source: string): Date {
  try {
    const stat = fs.statSync(path.join(process.cwd(), source))
    return stat.mtime
  } catch {
    // 回退到构建时间，避免生成失败
    return new Date()
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  return routeConfigs.map(({ path: routePath, priority, changeFrequency, source }) => ({
    url: `${SITE_URL}${routePath}`,
    lastModified: getLastModified(source),
    changeFrequency,
    priority,
  }))
}
