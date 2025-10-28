import type { Metadata } from 'next'

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const SITE_URL = rawSiteUrl
  ? (rawSiteUrl.startsWith('http://') || rawSiteUrl.startsWith('https://')
      ? rawSiteUrl
      : `https://${rawSiteUrl}`)
  : "https://lilith.xtower.site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "赞助者 | Phigros Query",
  description: "感谢各位赞助者对本项目的支持与贡献。正是有了您的帮助，我们才能持续提供成绩查询服务。",
  keywords: ["Phigros", "赞助商", "赞助支持", "合作伙伴", "项目赞助", "成绩查询赞助", "开源项目支持"],
  openGraph: {
    type: "website",
    url: "/sponsors",
    title: "赞助者 | Phigros Query",
    description: "感谢各位赞助者对本项目的支持与贡献。正是有了您的帮助，我们才能持续提供成绩查询服务。",
    siteName: "Phigros Query",
    images: [{ url: "/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "赞助者 | Phigros Query",
    description: "感谢各位赞助者对本项目的支持与贡献。正是有了您的帮助，我们才能持续提供成绩查询服务。",
    images: ["/og"],
  },
  alternates: {
    canonical: '/sponsors',
  },
}

export default function SponsorsLayout({ children }: { children: React.ReactNode }) {
  return children
}