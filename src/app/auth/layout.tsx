import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '认证信息 | Phigros Query',
  description: '查看当前登录状态与基础认证信息（敏感字段默认遮罩）。',
  keywords: ['Phigros', '认证信息', '登录状态', '技术支持'],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: 'website',
    url: '/auth',
    title: '认证信息 | Phigros Query',
    description: '查看当前登录状态与基础认证信息（敏感字段默认遮罩）。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '认证信息 | Phigros Query',
    description: '查看当前登录状态与基础认证信息（敏感字段默认遮罩）。',
    images: ['/og'],
  },
  alternates: {
    canonical: '/auth',
  },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children
}
