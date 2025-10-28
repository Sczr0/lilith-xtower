import type { Metadata } from 'next'

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const SITE_URL = rawSiteUrl
  ? (rawSiteUrl.startsWith('http://') || rawSiteUrl.startsWith('https://')
      ? rawSiteUrl
      : `https://${rawSiteUrl}`)
  : "https://lilith.xtower.site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "登录系统 | Phigros Query入口",
  description: "使用TapTap扫码、SessionToken手动输入、API凭证或联合查分平台等多种方式安全登录Phigros Query。我们支持多重认证机制，确保您的游戏数据安全，同时提供便捷的成绩查询和数据分析服务。",
  keywords: ["Phigros", "登录", "TapTap", "扫码登录", "SessionToken", "联合查分", "成绩查询"],
  openGraph: {
    type: "website",
    url: "/login",
    title: "登录系统 | Phigros Query入口",
    description: "使用TapTap扫码、SessionToken手动输入、API凭证或联合查分平台等多种方式安全登录Phigros Query。我们支持多重认证机制，确保您的游戏数据安全，同时提供便捷的成绩查询和数据分析服务。",
    siteName: "Phigros Query",
    images: [{ url: "/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "登录系统 | Phigros Query入口",
    description: "使用TapTap扫码、SessionToken手动输入、API凭证或联合查分平台等多种方式安全登录Phigros Query。我们支持多重认证机制，确保您的游戏数据安全，同时提供便捷的成绩查询和数据分析服务。",
    images: ["/og"],
  },
  alternates: {
    canonical: '/login',
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}

