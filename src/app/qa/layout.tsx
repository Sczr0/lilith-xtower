import type { Metadata } from 'next'
import { SITE_URL } from '../utils/site-url'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: '常见问题 | Phigros Query',
  description: 'Phigros Query 使用指南，涵盖登录认证、成绩查询、图片生成与 RKS 计算等常见问题的解答。',
  keywords: ['Phigros', '常见问题', '使用指南', '帮助文档', 'RKS 计算', 'Best N', '成绩查询', '登录问题'],
  openGraph: {
    type: 'website',
    url: '/qa',
    title: '常见问题 | Phigros Query',
    description: 'Phigros Query 使用指南，涵盖登录认证、成绩查询、图片生成与 RKS 计算等常见问题的解答。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og?title=常见问题', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '常见问题 | Phigros Query',
    description: 'Phigros Query 使用指南，涵盖登录认证、成绩查询、图片生成与 RKS 计算等常见问题的解答。',
    images: ['/og?title=常见问题'],
  },
  alternates: {
    canonical: '/qa',
  },
}

export default function QALayout({ children }: { children: React.ReactNode }) {
  return children
}
