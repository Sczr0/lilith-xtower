import type { Metadata } from 'next'

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const SITE_URL = rawSiteUrl
  ? (rawSiteUrl.startsWith('http://') || rawSiteUrl.startsWith('https://')
      ? rawSiteUrl
      : `https://${rawSiteUrl}`)
  : "https://lilith.xtower.site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "关于开发团队 - Phigros Query服务介绍与技术支持",
  description: "了解Phigros Query开发的背景，查看实时服务运行状态和用户统计数据。我们提供RKS计算、Best N查询和成绩图生成功能，帮助玩家了解自身的游戏表现。",
  keywords: ["Phigros", "关于", "开发者", "弦塔", "成绩查询", "RKS", "服务统计", "技术支持"],
  openGraph: {
    type: "website",
    url: "/about",
    title: "关于开发团队 - Phigros Query服务介绍与技术支持",
    description: "了解Phigros Query开发的背景，查看实时服务运行状态和用户统计数据。我们提供RKS计算、Best N查询和成绩图生成功能，帮助玩家了解自身的游戏表现。",
    siteName: "Phigros Query",
    images: [{ url: "/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "关于开发团队 - Phigros Query服务介绍与技术支持",
    description: "了解Phigros Query开发的背景，查看实时服务运行状态和用户统计数据。我们提供RKS计算、Best N查询和成绩图生成功能，帮助玩家了解自身的游戏表现。",
    images: ["/og"],
  },
  alternates: {
    canonical: '/about',
  },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children
}

