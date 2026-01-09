import type { Metadata } from 'next'
import { SITE_URL } from '../utils/site-url'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: '登录系统 | Phigros Query 入口',
  description: '欢迎登录 Phigros Query。我们支持 TapTap 扫码、SessionToken 以及 API 凭证等多种安全登录方式。登录后您可以查看详细的 Phigros 成绩统计、生成个性化的 Best N 成绩卡片，并使用我们的数据分析服务，尽力保护您的账号数据安全。',
  keywords: ['Phigros', '登录', 'TapTap', '扫码登录', 'SessionToken', 'API 凭证', '成绩查询'],
  openGraph: {
    type: 'website',
    url: '/login',
    title: '登录系统 | Phigros Query 入口',
    description: '欢迎登录 Phigros Query。我们支持 TapTap 扫码、SessionToken 以及 API 凭证等多种安全登录方式。登录后您可以查看详细的 Phigros 成绩统计、生成个性化的 Best N 成绩卡片，并使用我们的数据分析服务。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og?title=登录系统', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '登录系统 | Phigros Query 入口',
    description: '欢迎登录 Phigros Query。我们支持 TapTap 扫码、SessionToken 以及 API 凭证等多种安全登录方式。登录后您可以查看详细的 Phigros 成绩统计、生成个性化的 Best N 成绩卡片，并使用我们的数据分析服务。',
    images: ['/og?title=登录系统'],
  },
  alternates: {
    canonical: '/login',
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
