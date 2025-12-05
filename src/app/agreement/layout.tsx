import type { Metadata } from 'next'
import { SITE_URL } from '../utils/site-url'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: '用户协议 | Phigros Query',
  description: 'Phigros Query 用户协议与服务条款，说明服务范围、数据使用规范与用户权利义务，请在使用前仔细阅读。',
  keywords: ['Phigros', '用户协议', '服务条款', '数据使用', '用户权利', '法律条款', '使用规范'],
  openGraph: {
    type: 'website',
    url: '/agreement',
    title: '用户协议 | Phigros Query',
    description: 'Phigros Query 用户协议与服务条款，说明服务范围、数据使用规范与用户权利义务，请在使用前仔细阅读。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og?title=用户协议', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '用户协议 | Phigros Query',
    description: 'Phigros Query 用户协议与服务条款，说明服务范围、数据使用规范与用户权利义务，请在使用前仔细阅读。',
    images: ['/og?title=用户协议'],
  },
  alternates: {
    canonical: '/agreement',
  },
}

export default function AgreementLayout({ children }: { children: React.ReactNode }) {
  return children
}
