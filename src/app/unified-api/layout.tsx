import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '联合API接入（历史入口） | Phigros Query',
  description: '历史入口：访问该路由会自动跳转到联合 API 仪表盘（/unified-api-dashboard）。',
  keywords: ['Phigros', '联合查分API', '联合API', '绑定', '平台账号', '账号列表'],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: 'website',
    url: '/unified-api-dashboard',
    title: '联合API接入（历史入口） | Phigros Query',
    description: '历史入口：访问该路由会自动跳转到联合 API 仪表盘（/unified-api-dashboard）。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '联合API接入（历史入口） | Phigros Query',
    description: '历史入口：访问该路由会自动跳转到联合 API 仪表盘（/unified-api-dashboard）。',
    images: ['/og'],
  },
  alternates: {
    canonical: '/unified-api-dashboard',
  },
};

export default function UnifiedApiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
