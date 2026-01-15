import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '用户协议 | Phigros Query',
  description: '欢迎阅读 Phigros Query 用户协议与服务条款。本协议详细说明了我们的服务范围、数据使用与隐私保护规范、用户的权利与义务以及相关法律条款。为了保障您的合法权益，请在开始使用我们的成绩查询与分析服务前仔细阅读并理解相关内容。',
  keywords: ['Phigros', '用户协议', '服务条款', '数据使用', '用户权利', '法律条款', '使用规范'],
  openGraph: {
    type: 'website',
    url: '/agreement',
    title: '用户协议 | Phigros Query',
    description: '欢迎阅读 Phigros Query 用户协议与服务条款。本协议详细说明了我们的服务范围、数据使用与隐私保护规范、用户的权利与义务以及相关法律条款。为了保障您的合法权益，请在开始使用我们的成绩查询与分析服务前仔细阅读并理解相关内容。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og?title=用户协议', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '用户协议 | Phigros Query',
    description: '欢迎阅读 Phigros Query 用户协议与服务条款。本协议详细说明了我们的服务范围、数据使用与隐私保护规范、用户的权利与义务以及相关法律条款。为了保障您的合法权益，请在开始使用我们的成绩查询与分析服务前仔细阅读并理解相关内容。',
    images: ['/og?title=用户协议'],
  },
  alternates: {
    canonical: '/agreement',
  },
}

export default function AgreementLayout({ children }: { children: React.ReactNode }) {
  return children
}
