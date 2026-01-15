import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '联合API 仪表盘 | Phigros Query',
  description: '联合API 专属仪表盘：用于绑定、账号管理与查询工具等功能的集中入口。',
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: 'website',
    url: '/unified-api-dashboard',
    title: '联合API 仪表盘 | Phigros Query',
    description: '联合API 专属仪表盘：用于绑定、账号管理与查询工具等功能的集中入口。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '联合API 仪表盘 | Phigros Query',
    description: '联合API 专属仪表盘：用于绑定、账号管理与查询工具等功能的集中入口。',
    images: ['/og'],
  },
  alternates: {
    canonical: '/unified-api-dashboard',
  },
};

export default function UnifiedApiDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h1 className="sr-only">联合API 仪表盘 | Phigros Query</h1>
      {children}
    </>
  );
}
