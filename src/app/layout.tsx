import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthProvider } from "./contexts/AuthContext";
import { MaintenanceProvider } from "./components/MaintenanceProvider";
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

export const metadata: Metadata = {
  title: "Phigros Query",
  description: "Phigros 成绩查询与图片生成器",
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
          <AuthProvider agreementContent={agreementContent}>
            <MaintenanceProvider>
              {children}
            </MaintenanceProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
