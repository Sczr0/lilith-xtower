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
import { PromoBanner } from "./components/PromoBanner";
import { SITE_URL } from "./utils/site-url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Phigros Query - 专业的 Phigros 成绩查询与 RKS 数据分析工具",
    template: "%s | Phigros Query",
  },
  description:
    "Phigros Query 是一个专为 Phigros 玩家打造的综合性成绩查询与数据分析平台。我们提供精准的 RKS 计算、精美的 Best N 成绩卡片生成、详细的单曲表现分析以及便捷的成绩分享功能，帮助玩家更好地记录和提升游戏水平。",
  keywords: ["Phigros", "RKS 计算", "Best N", "成绩查询", "成绩卡片", "谱面数据", "成绩导出", "玩家工具"],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "Phigros Query - 专业的 Phigros 成绩查询与 RKS 数据分析工具",
    description:
      "Phigros Query 是一个专为 Phigros 玩家打造的综合性成绩查询与数据分析平台。我们提供精准的 RKS 计算、精美的 Best N 成绩卡片生成、详细的单曲表现分析以及便捷的成绩分享功能。",
    siteName: "Phigros Query",
    locale: "zh_CN",
    images: [{ url: "/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Phigros Query - 专业的 Phigros 成绩查询与 RKS 数据分析工具",
    description:
      "Phigros Query 是一个专为 Phigros 玩家打造的综合性成绩查询与数据分析平台。我们提供精准的 RKS 计算、精美的 Best N 成绩卡片生成、详细的单曲表现分析以及便捷的成绩分享功能。",
    images: ["/og"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 预连接站点与统计域名，减少 DNS/TLS/TCP 开销
  let originHref = SITE_URL;
  try {
    originHref = new URL(SITE_URL).origin;
  } catch {}

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 设置主题色，匹配亮/暗模式 */}
        <meta name="theme-color" content="#2563eb" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1e40af" media="(prefers-color-scheme: dark)" />
        {/* 关键域名预连接/预获取 */}
        <link rel="preconnect" href={originHref} crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cloud.umami.is" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//cloud.umami.is" />
        {/* Umami Cloud API Gateway */}
        <link rel="preconnect" href="https://api-gateway.umami.dev" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//api-gateway.umami.dev" />
        {/* font preload removed to reduce blocking download */}
        <Script
          src="https://cloud.umami.is/script.js"
          data-website-id="fcb3f5e6-8b71-4abe-bf83-684c3690b476"
          data-host-url="https://cloud.umami.is"
          data-domains="lilith.xtower.site"
          strategy="lazyOnload"
        />
        <Script id="brand-font-loader" strategy="afterInteractive">
          {`
          (function(){
            function loadBrandFonts(){
              try {
                var l = document.createElement('link');
                l.rel = 'stylesheet';
                l.href = '/fonts/Source%20Han%20Sans%20%26%20Saira%20Hybrid-Regular%20%235446/result.css';
                l.onload = function(){
                  try { document.documentElement.classList.add('brand-font'); } catch (e) {}
                };
                document.head.appendChild(l);
              } catch (e) {}
            }
            try {
              if (navigator.connection && navigator.connection.saveData) return;
              if (window.matchMedia && window.matchMedia('(prefers-reduced-data: reduce)').matches) return;
            } catch (e) {}
            if (window.requestIdleCallback) {
              window.requestIdleCallback(loadBrandFonts, { timeout: 2000 });
            } else {
              window.addEventListener('load', loadBrandFonts);
            }
          })();
          `}
        </Script>
        
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PromoBanner />
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
        <Analytics />
        <WebVitals />
      </body>
    </html>
  );
}
