import type { Metadata } from 'next'

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const SITE_URL = rawSiteUrl
  ? (rawSiteUrl.startsWith('http://') || rawSiteUrl.startsWith('https://')
      ? rawSiteUrl
      : `https://${rawSiteUrl}`)
  : "https://lilith.xtower.site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "认证调试 | Phigros Query",
  description: "Phigros查询服务认证调试，用于测试和技术支持。帮助开发者诊断登录问题，验证认证流程，确保服务正常运行。",
  keywords: ["Phigros", "认证调试", "开发工具", "技术支持", "登录诊断", "认证测试", "调试工具", "开发者工具"],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: "website",
    url: "/debug-auth",
    title: "认证调试 | Phigros Query",
    description: "Phigros查询服务认证调试，用于测试和技术支持。帮助开发者诊断登录问题，验证认证流程，确保服务正常运行。",
    siteName: "Phigros Query",
    images: [{ url: "/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "认证调试 | Phigros Query",
    description: "Phigros查询服务认证调试，用于测试和技术支持。帮助开发者诊断登录问题，验证认证流程，确保服务正常运行。",
    images: ["/og"],
  },
  alternates: {
    canonical: '/debug-auth',
  },
}

export default function DebugAuthLayout({ children }: { children: React.ReactNode }) {
  return children
}

