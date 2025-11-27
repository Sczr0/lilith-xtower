import type { MetadataRoute } from 'next'

const RAW = process.env.NEXT_PUBLIC_SITE_URL
const SITE_URL = RAW
  ? (RAW.startsWith('http://') || RAW.startsWith('https://') ? RAW : `https://${RAW}`)
  : 'https://lilith.xtower.site'

// 路由配置：包含优先级和更新频率
interface RouteConfig {
  path: string
  priority: number
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
}

const routeConfigs: RouteConfig[] = [
  // 核心页面 - 高优先级
  { path: '/', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/login', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/dashboard', priority: 0.8, changeFrequency: 'weekly' },
  
  // 内容页面 - 中优先级
  { path: '/qa', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/sponsors', priority: 0.5, changeFrequency: 'monthly' },
  
  // 法律/政策页面 - 低优先级，很少更新
  { path: '/agreement', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  
  // 工具/调试页面 - 最低优先级
  { path: '/debug-auth', priority: 0.2, changeFrequency: 'monthly' },
  { path: '/demo/score-card', priority: 0.2, changeFrequency: 'monthly' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return routeConfigs.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }))
}
