import type { Metadata } from 'next'
import { SITE_URL } from '../utils/site-url'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: '登录系统 | Phigros Query 入口',
  description: '支持 TapTap 扫码、SessionToken、API 凭证等方式安全登录 Phigros Query，保护账号数据并提供成绩查询与分析服务。',
  keywords: ['Phigros', '登录', 'TapTap', '扫码登录', 'SessionToken', 'API 凭证', '成绩查询'],
  openGraph: {
    type: 'website',
    url: '/login',
    title: '登录系统 | Phigros Query 入口',
    description: '支持 TapTap 扫码、SessionToken、API 凭证等方式安全登录 Phigros Query，保护账号数据并提供成绩查询与分析服务。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og?title=登录系统', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '登录系统 | Phigros Query 入口',
    description: '支持 TapTap 扫码、SessionToken、API 凭证等方式安全登录 Phigros Query，保护账号数据并提供成绩查询与分析服务。',
    images: ['/og?title=登录系统'],
  },
  alternates: {
    canonical: '/login',
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
