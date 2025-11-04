import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
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
// Removed fs/path – agreement HTML now loaded on demand in AuthProvider via manifest

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
  // 允许通过环境变量逗号分隔指定需要预加载的 CSS 路径（部署期注入，以避免哈希失配）
  const cssPreloadRaw = process.env.NEXT_PUBLIC_PRELOAD_CSS || "";
  const cssPreloads = cssPreloadRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s.startsWith("/"));

  // 如未通过环境变量提供，则优先读取构建阶段生成的 .next/static/preload-css.json（与当前构建强一致）
  if (cssPreloads.length === 0) {
    try {
      const pNext = path.join(process.cwd(), ".next", "static", "preload-css.json");
      if (fs.existsSync(pNext)) {
        const raw = fs.readFileSync(pNext, "utf8");
        const json = JSON.parse(raw);
        const arr = Array.isArray(json?.css) ? json.css : [];
        for (const href of arr) if (typeof href === "string" && href.startsWith("/")) cssPreloads.push(href);
      }
    } catch {}
  }
  // 仍未获得，则尝试 public/preload-css.json（兼容旧版本，但存在与构建不同步风险）
  if (cssPreloads.length === 0) {
    try {
      const pPub = path.join(process.cwd(), "public", "preload-css.json");
      if (fs.existsSync(pPub)) {
        const raw = fs.readFileSync(pPub, "utf8");
        const json = JSON.parse(raw);
        const arr = Array.isArray(json?.css) ? json.css : [];
        for (const href of arr) if (typeof href === "string" && href.startsWith("/")) cssPreloads.push(href);
      }
    } catch {}
  }

  // 站点源用于 preconnect（提前完成 DNS/TLS/TCP）
  let originHref = SITE_URL;
  try {
    originHref = new URL(SITE_URL).origin;
  } catch {}

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 预连接到本站源 */}
        <link rel="preconnect" href={originHref} crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cloud.umami.is" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//cloud.umami.is" />
        {/* Umami Cloud API Gateway 预连接，避免 CSP 拦截与提前握手 */}
        <link rel="preconnect" href="https://api-gateway.umami.dev" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//api-gateway.umami.dev" />
        {/* 预加载本地自托管字体，提升首屏渲染 */}
        {/* font preload removed to reduce blocking download */}
        {/* 指定 host-url 以避免脚本转发到 api-gateway 导致的跨域问题 */}
        <Script
          src="https://cloud.umami.is/script.js"
          data-website-id="fcb3f5e6-8b71-4abe-bf83-684c3690b476"
          data-host-url="https://cloud.umami.is"
          data-domains="lilith.xtower.site"
          strategy="lazyOnload"
        />
        {/* 按需预加载首屏关键 CSS（仅当设置 NEXT_PUBLIC_PRELOAD_CSS 时注入） */}
        {cssPreloads.map((href) => (
          <link key={href} rel="preload" as="style" href={href} />
        ))}
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
          <Suspense fallback={null}>
            <AuthProvider>
              <MaintenanceProvider>
                <GenerationProvider>
                  {children}
                </GenerationProvider>
              </MaintenanceProvider>
            </AuthProvider>
          </Suspense>
        </ThemeProvider>
        <Analytics />
        <WebVitals />
      </body>
    </html>
  );
}
