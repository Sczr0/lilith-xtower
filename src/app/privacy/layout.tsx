import type { Metadata } from 'next'

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const SITE_URL = rawSiteUrl
  ? (rawSiteUrl.startsWith('http://') || rawSiteUrl.startsWith('https://')
      ? rawSiteUrl
      : `https://${rawSiteUrl}`)
  : "https://lilith.xtower.site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "隐私协议 | Phigros Query",
  description: "Phigros查询服务隐私协议，详细说明我们如何收集、使用、存储和保护您的个人信息。",
  keywords: ["Phigros", "隐私协议", "隐私政策", "个人信息保护", "数据安全", "用户隐私"],
  openGraph: {
    type: "website",
    url: "/privacy",
    title: "隐私协议 | Phigros Query",
    description: "Phigros查询服务隐私协议，详细说明我们如何收集、使用、存储和保护您的个人信息。",
    siteName: "Phigros Query",
    images: [{ url: "/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "隐私协议 | Phigros Query",
    description: "Phigros查询服务隐私协议，详细说明我们如何收集、使用、存储和保护您的个人信息。",
    images: ["/og"],
  },
  alternates: {
    canonical: '/privacy',
  },
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children
}