import type { Metadata } from 'next'

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const SITE_URL = rawSiteUrl
  ? (rawSiteUrl.startsWith('http://') || rawSiteUrl.startsWith('https://')
      ? rawSiteUrl
      : `https://${rawSiteUrl}`)
  : "https://lilith.xtower.site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "常见问题 | Phigros Query",
  description: "Phigros查询工具使用指南，涵盖登录认证、成绩查询、图片生成等常见问题解答。快速找到解决方案，顺畅使用各项功能服务。",
  keywords: ["Phigros", "常见问题", "使用指南", "疑难解答", "帮助文档", "成绩查询帮助", "RKS计算指南"],
  openGraph: {
    type: "website",
    url: "/qa",
    title: "常见问题 | Phigros Query",
    description: "Phigros查询工具使用指南，涵盖登录认证、成绩查询、图片生成等常见问题解答。快速找到解决方案，顺畅使用各项功能服务。",
    siteName: "Phigros Query",
    images: [{ url: "/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "常见问题 | Phigros Query",
    description: "Phigros查询工具使用指南，涵盖登录认证、成绩查询、图片生成等常见问题解答。快速找到解决方案，顺畅使用各项功能服务。",
    images: ["/og"],
  },
  alternates: {
    canonical: '/qa',
  },
}

export default function QALayout({ children }: { children: React.ReactNode }) {
  return children
}
