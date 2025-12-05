import type { Metadata } from 'next'
import { SITE_URL } from '../utils/site-url'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: '认证调试 | Phigros Query',
  description: '用于调试与技术支持的认证测试页面，帮助开发者诊断登录问题并验证认证流程，确保服务稳定。',
  keywords: ['Phigros', '认证调试', '开发工具', '技术支持', '登录诊断', '认证测试', '调试工具'],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: 'website',
    url: '/debug-auth',
    title: '认证调试 | Phigros Query',
    description: '用于调试与技术支持的认证测试页面，帮助开发者诊断登录问题并验证认证流程，确保服务稳定。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '认证调试 | Phigros Query',
    description: '用于调试与技术支持的认证测试页面，帮助开发者诊断登录问题并验证认证流程，确保服务稳定。',
    images: ['/og'],
  },
  alternates: {
    canonical: '/debug-auth',
  },
}

export default function DebugAuthLayout({ children }: { children: React.ReactNode }) {
  return children
}
