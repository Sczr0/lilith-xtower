import type { Metadata } from 'next'
import { SITE_URL } from '../utils/site-url'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: '赞助者 | Phigros Query',
  description: '感谢所有赞助者对 Phigros Query 的支持，帮助我们持续提供成绩查询、RKS 计算与分享服务。',
  keywords: ['Phigros', '赞助', '赞助支持', '项目赞助', '开源赞助', '成绩查询', 'RKS 计算'],
  openGraph: {
    type: 'website',
    url: '/sponsors',
    title: '赞助者 | Phigros Query',
    description: '感谢所有赞助者对 Phigros Query 的支持，帮助我们持续提供成绩查询、RKS 计算与分享服务。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og?title=赞助者', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '赞助者 | Phigros Query',
    description: '感谢所有赞助者对 Phigros Query 的支持，帮助我们持续提供成绩查询、RKS 计算与分享服务。',
    images: ['/og?title=赞助者'],
  },
  alternates: {
    canonical: '/sponsors',
  },
}

export default function SponsorsLayout({ children }: { children: React.ReactNode }) {
  return children
}
