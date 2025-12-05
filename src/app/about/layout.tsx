import type { Metadata } from 'next'
import { SITE_URL } from '../utils/site-url'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: '关于开发团队 - Phigros Query 服务介绍与技术支持',
  description: '了解 Phigros Query 的背景、团队、运行状态与用户统计，提供 RKS 计算、Best N 成绩查询与成绩卡片生成等服务。',
  keywords: ['Phigros', '关于', '开发者', '塔弦', '成绩查询', 'RKS', '服务统计', '技术支持'],
  openGraph: {
    type: 'website',
    url: '/about',
    title: '关于开发团队 - Phigros Query 服务介绍与技术支持',
    description: '了解 Phigros Query 的背景、团队、运行状态与用户统计，提供 RKS 计算、Best N 成绩查询与成绩卡片生成等服务。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og?title=关于开发团队', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '关于开发团队 - Phigros Query 服务介绍与技术支持',
    description: '了解 Phigros Query 的背景、团队、运行状态与用户统计，提供 RKS 计算、Best N 成绩查询与成绩卡片生成等服务。',
    images: ['/og?title=关于开发团队'],
  },
  alternates: {
    canonical: '/about',
  },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children
}
