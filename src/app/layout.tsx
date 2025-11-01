import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthProvider } from "./contexts/AuthContext";
import { MaintenanceProvider } from "./components/MaintenanceProvider";
import { GenerationProvider } from "./contexts/GenerationContext";
import { MaintenanceNotice } from "./components/MaintenanceNotice";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import fs from 'fs';
import path from 'path';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const SITE_URL = rawSiteUrl
  ? (rawSiteUrl.startsWith('http://') || rawSiteUrl.startsWith('https://')
      ? rawSiteUrl
      : `https://${rawSiteUrl}`)
  : "https://lilith.xtower.site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Phigros Query",
    template: "%s | Phigros Query",
  },
  description: "Phigros Query是一个由空间站「塔弦」主导制作的一个Phigros游戏成绩查询工具，全内容由LLM开发，并提供RKS查看、Best N查询、Best N 成绩图表生成和数据分析服务，支持多种登录方式。",
  keywords: ["Phigros", "成绩查询", "RKS", "Best N", "图片生成", "塔弦"],
  openGraph: {
    type: "website",
    url: "/",
    title: "Phigros Query",
    description: "Phigros Query是一个由空间站「塔弦」主导制作的一个Phigros游戏成绩查询工具，全内容由LLM开发，并提供RKS查看、Best N查询、Best N 成绩图表生成和数据分析服务，支持多种登录方式。",
    siteName: "Phigros Query",
    images: [{ url: "/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Phigros Query",
    description: "Phigros Query是一个由空间站「塔弦」主导制作的一个Phigros游戏成绩查询工具，全内容由LLM开发，并提供RKS查看、Best N查询、Best N 成绩图表生成和数据分析服务，支持多种登录方式。",
    images: ["/og"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const agreementContent = fs.readFileSync(
    path.join(process.cwd(), 'src', 'app', 'agreement', 'agreement.md'),
    'utf8'
  );

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cloud.umami.is" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//cloud.umami.is" />
        <script defer src="https://cloud.umami.is/script.js" data-website-id="fcb3f5e6-8b71-4abe-bf83-684c3690b476"></script>
        {/* 延迟加载中文网字计划生成的本地分片 CSS，避免进入 LCP 关键路径 */}
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
          <MaintenanceNotice />
          <AuthProvider agreementContent={agreementContent}>
            <MaintenanceProvider>
              <GenerationProvider>
                {children}
              </GenerationProvider>
            </MaintenanceProvider>
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
