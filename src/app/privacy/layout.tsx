import type { Metadata } from 'next'
import { SITE_URL } from '../utils/site-url'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: '隐私协议 | Phigros Query',
  description: 'Phigros Query 隐私政策，说明我们如何收集、使用、存储和保护您的个人信息，保障数据安全与合规。',
  keywords: ['Phigros', '隐私协议', '隐私政策', '个人信息保护', '数据安全', '用户隐私'],
  openGraph: {
    type: 'website',
    url: '/privacy',
    title: '隐私协议 | Phigros Query',
    description: 'Phigros Query 隐私政策，说明我们如何收集、使用、存储和保护您的个人信息，保障数据安全与合规。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og?title=隐私协议', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '隐私协议 | Phigros Query',
    description: 'Phigros Query 隐私政策，说明我们如何收集、使用、存储和保护您的个人信息，保障数据安全与合规。',
    images: ['/og?title=隐私协议'],
  },
  alternates: {
    canonical: '/privacy',
  },
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children
}
