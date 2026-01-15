import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '关于开发团队 - Phigros Query 服务介绍与技术支持',
  description: '深入了解 Phigros Query 的开发背景、核心团队、实时运行状态以及详细的用户统计数据。我们致力于为 Phigros 玩家提供最专业、最便捷的 RKS 计算、Best N 成绩查询与精美成绩卡片生成等技术支持服务。',
  keywords: ['Phigros', '关于', '开发者', '塔弦', '成绩查询', 'RKS', '服务统计', '技术支持'],
  openGraph: {
    type: 'website',
    url: '/about',
    title: '关于开发团队 - Phigros Query 服务介绍与技术支持',
    description: '深入了解 Phigros Query 的开发背景、核心团队、实时运行状态以及详细的用户统计数据。我们致力于为 Phigros 玩家提供最专业、最便捷的 RKS 计算、Best N 成绩查询与精美成绩卡片生成等技术支持服务。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og?title=关于开发团队', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '关于开发团队 - Phigros Query 服务介绍与技术支持',
    description: '深入了解 Phigros Query 的开发背景、核心团队、实时运行状态以及详细的用户统计数据。我们致力于为 Phigros 玩家提供最专业、最便捷的 RKS 计算、Best N 成绩查询与精美成绩卡片生成等技术支持服务。',
    images: ['/og?title=关于开发团队'],
  },
  alternates: {
    canonical: '/about',
  },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children
}
