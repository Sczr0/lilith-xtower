import type { Metadata } from 'next'

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const SITE_URL = rawSiteUrl
  ? (rawSiteUrl.startsWith('http://') || rawSiteUrl.startsWith('https://')
      ? rawSiteUrl
      : `https://${rawSiteUrl}`)
  : "https://lilith.xtower.site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "成绩单演示 | Phigros Query",
  description: "Phigros成绩单样式演示页面，展示各种精美的成绩单设计和图片生成效果。查看不同风格的成绩卡片样式。",
  keywords: ["Phigros", "成绩单演示", "样式展示", "图片生成", "成绩卡片", "设计预览", "效果演示", "样式模板"],
  openGraph: {
    type: "website",
    url: "/demo/score-card",
    title: "成绩单演示 | Phigros Query",
    description: "Phigros成绩单样式演示页面，展示各种精美的成绩单设计和图片生成效果。查看不同风格的成绩卡片样式。",
    siteName: "Phigros Query",
    images: [{ url: "/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "成绩单演示 | Phigros Query",
    description: "Phigros成绩单样式演示页面，展示各种精美的成绩单设计和图片生成效果。查看不同风格的成绩卡片样式。",
    images: ["/og"],
  },
  alternates: {
    canonical: '/demo/score-card',
  },
}

export default function ScoreCardDemoLayout({ children }: { children: React.ReactNode }) {
  return children
}

