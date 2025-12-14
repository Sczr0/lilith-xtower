import type { Metadata } from 'next'
import { SITE_URL } from '../../utils/site-url'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'BestN SVG 渲染测试 | Phigros Query',
  description: '用于测试前端是否能正常渲染后端返回的 SVG 格式 BestN 图片（通过 format=svg 获取）。',
  keywords: ['Phigros', 'BestN', 'SVG', '渲染测试', 'demo'],
  openGraph: {
    type: 'website',
    url: '/demo/bestn-svg',
    title: 'BestN SVG 渲染测试 | Phigros Query',
    description: '用于测试前端是否能正常渲染后端返回的 SVG 格式 BestN 图片（通过 format=svg 获取）。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BestN SVG 渲染测试 | Phigros Query',
    description: '用于测试前端是否能正常渲染后端返回的 SVG 格式 BestN 图片（通过 format=svg 获取）。',
    images: ['/og'],
  },
  alternates: {
    canonical: '/demo/bestn-svg',
  },
}

export default function BestNSvgDemoLayout({ children }: { children: React.ReactNode }) {
  return children
}

