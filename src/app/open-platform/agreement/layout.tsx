import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '开放平台协议 | Phigros Query',
  description:
    'Phigros Query 开放平台协议页面，详细说明开发者账户申请、GitHub 登录绑定、API Key 管理、调用限制、数据安全、合规责任与违规处理规则。',
  keywords: ['Phigros', '开放平台', '开发者协议', 'API Key', 'GitHub 登录', '调用规范'],
  openGraph: {
    type: 'website',
    url: '/open-platform/agreement',
    title: '开放平台协议 | Phigros Query',
    description:
      'Phigros Query 开放平台协议页面，详细说明开发者账户申请、GitHub 登录绑定、API Key 管理、调用限制、数据安全、合规责任与违规处理规则。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og?title=开放平台协议', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '开放平台协议 | Phigros Query',
    description:
      'Phigros Query 开放平台协议页面，详细说明开发者账户申请、GitHub 登录绑定、API Key 管理、调用限制、数据安全、合规责任与违规处理规则。',
    images: ['/og?title=开放平台协议'],
  },
  alternates: {
    canonical: '/open-platform/agreement',
  },
};

export default function OpenPlatformAgreementLayout({ children }: { children: React.ReactNode }) {
  return children;
}
