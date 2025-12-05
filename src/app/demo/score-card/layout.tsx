import type { Metadata } from 'next'
import { SITE_URL } from '../../utils/site-url'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: '成绩单演示 | Phigros Query',
  description: 'Phigros 成绩单样式演示，展示多种成绩卡片设计与图片生成效果，预览不同风格的分享模板。',
  keywords: ['Phigros', '成绩单演示', '样式展示', '图片生成', '成绩卡片', '设计预览', '模板效果'],
  openGraph: {
    type: 'website',
    url: '/demo/score-card',
    title: '成绩单演示 | Phigros Query',
    description: 'Phigros 成绩单样式演示，展示多种成绩卡片设计与图片生成效果，预览不同风格的分享模板。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '成绩单演示 | Phigros Query',
    description: 'Phigros 成绩单样式演示，展示多种成绩卡片设计与图片生成效果，预览不同风格的分享模板。',
    images: ['/og'],
  },
  alternates: {
    canonical: '/demo/score-card',
  },
}

export default function ScoreCardDemoLayout({ children }: { children: React.ReactNode }) {
  return children
}
