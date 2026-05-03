import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '隐私协议',
  description:
    'Phigros Query 隐私协议页面，详细说明我们如何收集、使用、存储、共享与保护您的个人信息，以及 Cookie、日志与账号数据在查询服务中的处理规则。',
  keywords: ['Phigros', '隐私协议', '隐私政策', '个人信息保护', '数据安全', '用户隐私'],
  openGraph: {
    type: 'website',
    url: '/privacy',
    title: '隐私协议',
    description:
      'Phigros Query 隐私协议页面，详细说明我们如何收集、使用、存储、共享与保护您的个人信息，以及 Cookie、日志与账号数据在查询服务中的处理规则。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og?title=隐私协议', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '隐私协议',
    description:
      'Phigros Query 隐私协议页面，详细说明我们如何收集、使用、存储、共享与保护您的个人信息，以及 Cookie、日志与账号数据在查询服务中的处理规则。',
    images: ['/og?title=隐私协议'],
  },
  alternates: {
    canonical: '/privacy',
  },
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children
}
