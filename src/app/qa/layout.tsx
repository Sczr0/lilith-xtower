import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '常见问题 | Phigros Query',
  description: 'Phigros Query 官方使用指南与常见问题解答。本页面涵盖了从登录认证、成绩查询、Best N 图片生成到 RKS 计算原理等全方位的操作指导，旨在帮助玩家快速上手并解决在使用过程中遇到的各类技术问题。',
  keywords: ['Phigros', '常见问题', '使用指南', '帮助文档', 'RKS 计算', 'Best N', '成绩查询', '登录问题'],
  openGraph: {
    type: 'website',
    url: '/qa',
    title: '常见问题 | Phigros Query',
    description: 'Phigros Query 官方使用指南与常见问题解答。本页面涵盖了从登录认证、成绩查询、Best N 图片生成到 RKS 计算原理等全方位的操作指导，旨在帮助玩家快速上手并解决在使用过程中遇到的各类技术问题。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og?title=常见问题', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '常见问题 | Phigros Query',
    description: 'Phigros Query 官方使用指南与常见问题解答。本页面涵盖了从登录认证、成绩查询、Best N 图片生成到 RKS 计算原理等全方位的操作指导，旨在帮助玩家快速上手并解决在使用过程中遇到的各类技术问题。',
    images: ['/og?title=常见问题'],
  },
  alternates: {
    canonical: '/qa',
  },
}

export default function QALayout({ children }: { children: React.ReactNode }) {
  return children
}
