import type { Metadata } from 'next'

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const SITE_URL = rawSiteUrl
  ? (rawSiteUrl.startsWith('http://') || rawSiteUrl.startsWith('https://')
      ? rawSiteUrl
      : `https://${rawSiteUrl}`)
  : "https://lilith.xtower.site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "个人成绩仪表盘 - Phigros Query",
  description: "分析您的Phigros游戏表现，为用户提供个性化的成绩图展示并提供下载。",
  keywords: ["Phigros", "成绩统计", "数据分析", "RKS趋势", "Best N排名", "游戏仪表盘", "成绩分析"],
  openGraph: {
    type: "website",
    url: "/dashboard",
    title: "个人成绩仪表盘 - Phigros Query",
    description: "分析您的Phigros游戏表现，为用户提供个性化的成绩图展示并提供下载。",
    siteName: "Phigros Query",
    images: [{ url: "/og?title=个人成绩仪表盘", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "个人成绩仪表盘 - Phigros Query",
    description: "分析您的Phigros游戏表现，为用户提供个性化的成绩图展示并提供下载。",
    images: ["/og?title=个人成绩仪表盘"],
  },
  alternates: {
    canonical: '/dashboard',
  },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}

