import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '赞助者名单 - 感谢支持 Phigros Query 的每一位朋友',
  description: '衷心感谢所有赞助者对 Phigros Query 的慷慨支持。正是因为有了你们的帮助，我们才能持续维护并优化这个面向 Phigros 玩家的成绩查询、RKS 计算与精美成绩卡片生成服务，让项目能够长久稳定地运行下去。',
  keywords: ['Phigros', '赞助', '赞助支持', '项目赞助', '开源赞助', '成绩查询', 'RKS 计算'],
  openGraph: {
    type: 'website',
    url: '/sponsors',
    title: '赞助者名单 - 感谢支持 Phigros Query 的每一位朋友',
    description: '衷心感谢所有赞助者对 Phigros Query 的慷慨支持。正是因为有了你们的帮助，我们才能持续维护并优化这个面向 Phigros 玩家的成绩查询、RKS 计算与精美成绩卡片生成服务。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og?title=赞助者', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '赞助者名单 - 感谢支持 Phigros Query 的每一位朋友',
    description: '衷心感谢所有赞助者对 Phigros Query 的慷慨支持。正是因为有了你们的帮助，我们才能持续维护并优化这个面向 Phigros 玩家的成绩查询、RKS 计算与精美成绩卡片生成服务。',
    images: ['/og?title=赞助者'],
  },
  alternates: {
    canonical: '/sponsors',
  },
}

export default function SponsorsLayout({ children }: { children: React.ReactNode }) {
  return children
}
