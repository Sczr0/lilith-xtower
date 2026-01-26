import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthProvider } from "./contexts/AuthContext";
import { MaintenanceProvider } from "./components/MaintenanceProvider";
import { GenerationProvider } from "./contexts/GenerationContext";
import { MaintenanceNotice } from "./components/MaintenanceNotice";
import { Analytics } from "@vercel/analytics/next";
import { Suspense } from "react";
import Script from "next/script";
import WebVitals from "./components/WebVitals";
import { TipsProvider } from "./components/TipsProvider";
import { PromoBannerSlot } from "./components/PromoBannerSlot";
import { BrandFontLoader } from "./components/BrandFontLoader";
import { headers } from "next/headers";
import { SITE_URL } from "./utils/site-url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 非 Vercel 或未启用 Web Analytics 时，禁用 @vercel/analytics 以避免控制台 404 噪音
const ENABLE_VERCEL_ANALYTICS = (() => {
  const raw = (process.env.NEXT_PUBLIC_VERCEL_ANALYTICS || "").toLowerCase();
  return raw === "1" || raw === "true";
})();

// 说明：middleware.ts 为每个请求生成 CSP nonce。
// Next.js 只有在按请求渲染 HTML 时才能把 nonce 注入到其内联脚本；若静态化则会因脚本缺少 nonce 被 CSP 阻止，出现白屏。
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Phigros Query - 不专业的 Phigros 成绩查询与 RKS 数据分析工具",
    template: "%s | Phigros Query",
  },
  description:
    "Phigros Query 是一个专为 Phigros 玩家打造的综合性成绩查询与数据分析平台。我们提供精准的 RKS 计算、精美的 Best N 成绩卡片生成、详细的单曲表现分析以及便捷的成绩分享功能，帮助玩家更好地记录和提升游戏水平。",
  keywords: ["Phigros", "RKS 计算", "Best N", "成绩查询", "成绩卡片", "谱面数据", "成绩导出", "玩家工具"],
  openGraph: {
    type: "website",
    url: "/",
    title: "Phigros Query - 不专业的 Phigros 成绩查询与 RKS 数据分析工具",
    description:
      "Phigros Query 是一个专为 Phigros 玩家打造的综合性成绩查询与数据分析平台。我们提供精准的 RKS 计算、精美的 Best N 成绩卡片生成、详细的单曲表现分析以及便捷的成绩分享功能。",
    siteName: "Phigros Query",
    locale: "zh_CN",
    images: [{ url: "/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Phigros Query - 不专业的 Phigros 成绩查询与 RKS 数据分析工具",
    description:
      "Phigros Query 是一个专为 Phigros 玩家打造的综合性成绩查询与数据分析平台。我们提供精准的 RKS 计算、精美的 Best N 成绩卡片生成、详细的单曲表现分析以及便捷的成绩分享功能。",
    images: ["/og"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 获取 CSP nonce（由 middleware 生成并透传），用于 Script 与 ThemeProvider
  const nonce = (await headers()).get('x-nonce') || undefined;

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 设置主题色，匹配亮/暗模式 */}
        <meta name="theme-color" content="#2563eb" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1e40af" media="(prefers-color-scheme: dark)" />
        {/* 关键域名 DNS 预解析（降级 preconnect 以避免过多 TCP 连接占用带宽） */}
        <link rel="dns-prefetch" href="//cloud.umami.is" />
        <link rel="dns-prefetch" href="//api-gateway.umami.dev" />
        <link rel="dns-prefetch" href="//somnia.xtower.site" />
        {/* font preload removed to reduce blocking download */}
        <Script
          src="https://cloud.umami.is/script.js"
          data-website-id="fcb3f5e6-8b71-4abe-bf83-684c3690b476"
          data-host-url="https://cloud.umami.is"
          data-domains="lilith.xtower.site"
          strategy="lazyOnload"
          nonce={nonce}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <BrandFontLoader />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          <PromoBannerSlot />
          <TipsProvider>
            <MaintenanceNotice />
            <Suspense fallback={null}>
              <AuthProvider>
                <MaintenanceProvider>
                  <GenerationProvider>
                    {children}
                  </GenerationProvider>
                </MaintenanceProvider>
              </AuthProvider>
            </Suspense>
          </TipsProvider>
        </ThemeProvider>
        {ENABLE_VERCEL_ANALYTICS ? <Analytics /> : null}
        <WebVitals />
      </body>
    </html>
  );
}
