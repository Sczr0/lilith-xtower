import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthProvider } from "./contexts/AuthContext";
import { MaintenanceProvider } from "./components/MaintenanceProvider";
import { GenerationProvider } from "./contexts/GenerationContext";
import { MaintenanceNotice } from "./components/MaintenanceNotice";
import { Analytics } from "@vercel/analytics/next";
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
  description: "Phigros 成绩查询与图片生成器",
  keywords: ["Phigros", "成绩查询", "RKS", "Best N", "图片生成", "塔弦"],
  openGraph: {
    type: "website",
    url: "/",
    title: "Phigros Query",
    description: "Phigros 成绩查询与图片生成器",
    siteName: "Phigros Query",
    images: [{ url: "/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Phigros Query",
    description: "Phigros 成绩查询与图片生成器",
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
        <link
          rel="stylesheet"
          href="https://ik.imagekit.io/Sczr/Source%20Han%20Sans%20&%20Saira%20Hybrid-Regular%20(1)/result.css?updatedAt=1733583831964"
        />
        <script defer src="https://cloud.umami.is/script.js" data-website-id="fcb3f5e6-8b71-4abe-bf83-684c3690b476"></script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ fontFamily: "'Source Han Sans & Saira Hybrid', sans-serif" }}
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
