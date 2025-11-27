import type { Metadata } from 'next'

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const SITE_URL = rawSiteUrl
  ? (rawSiteUrl.startsWith('http://') || rawSiteUrl.startsWith('https://')
      ? rawSiteUrl
      : `https://${rawSiteUrl}`)
  : "https://lilith.xtower.site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "用户协议 | Phigros Query",
  description: "Phigros查询服务用户协议与隐私政策，详细说明服务条款、数据使用规范、用户权利义务等内容。使用本服务即表示您同意相关条款。",
  keywords: ["Phigros", "用户协议", "隐私政策", "服务条款", "数据使用", "用户权利", "法律条款", "使用规范"],
  openGraph: {
    type: "website",
    url: "/agreement",
    title: "用户协议 | Phigros Query",
    description: "Phigros查询服务用户协议与隐私政策，详细说明服务条款、数据使用规范、用户权利义务等内容。使用本服务即表示您同意相关条款。",
    siteName: "Phigros Query",
    images: [{ url: "/og?title=用户协议", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "用户协议 | Phigros Query",
    description: "Phigros查询服务用户协议与隐私政策，详细说明服务条款、数据使用规范、用户权利义务等内容。使用本服务即表示您同意相关条款。",
    images: ["/og?title=用户协议"],
  },
  alternates: {
    canonical: '/agreement',
  },
}

export default function AgreementLayout({ children }: { children: React.ReactNode }) {
  return children
}

