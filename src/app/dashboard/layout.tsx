import type { Metadata } from 'next'
import { SITE_URL } from '../utils/site-url'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: '个人成绩仪表盘 - Phigros Query',
  description: '集中查看与分析您的 Phigros 成绩，展示 RKS 走势、Best N 列表、单曲表现，并支持图片导出。',
  keywords: ['Phigros', '成绩统计', '数据分析', 'RKS 趋势', 'Best N', '成绩仪表盘', '成绩导出'],
  openGraph: {
    type: 'website',
    url: '/dashboard',
    title: '个人成绩仪表盘 - Phigros Query',
    description: '集中查看与分析您的 Phigros 成绩，展示 RKS 走势、Best N 列表、单曲表现，并支持图片导出。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og?title=个人成绩仪表盘', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '个人成绩仪表盘 - Phigros Query',
    description: '集中查看与分析您的 Phigros 成绩，展示 RKS 走势、Best N 列表、单曲表现，并支持图片导出。',
    images: ['/og?title=个人成绩仪表盘'],
  },
  alternates: {
    canonical: '/dashboard',
  },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
