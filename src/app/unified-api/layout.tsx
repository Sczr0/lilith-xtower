import type { Metadata } from 'next';
import { SITE_URL } from '../utils/site-url';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: '联合API接入 | Phigros Query',
  description: '用于将本站账号绑定到第三方联合查分 API，并展示用户已绑定的所有平台账号。',
  keywords: ['Phigros', '联合查分API', '联合API', '绑定', '平台账号', '账号列表'],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: 'website',
    url: '/unified-api',
    title: '联合API接入 | Phigros Query',
    description: '用于将本站账号绑定到第三方联合查分 API，并展示用户已绑定的所有平台账号。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '联合API接入 | Phigros Query',
    description: '用于将本站账号绑定到第三方联合查分 API，并展示用户已绑定的所有平台账号。',
    images: ['/og'],
  },
  alternates: {
    canonical: '/unified-api',
  },
};

export default function UnifiedApiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
