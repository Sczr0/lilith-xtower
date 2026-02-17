import type { Metadata } from 'next';
import { PageShell } from '../components/PageShell';
import { SiteHeader } from '../components/SiteHeader';
import { safeJsonLdStringify } from '../lib/security/safeJsonLdStringify';
import { SITE_URL } from '../utils/site-url';
import { OpenPlatformBetaDashboard } from './components/OpenPlatformBetaDashboard';

export const metadata: Metadata = {
  title: '开发者仪表盘 Beta | Phigros Query',
  description: 'Phigros Query 开发者仪表盘 Beta：提供 GitHub 登录与 API Key 申请、轮换、撤销能力。',
  alternates: {
    canonical: '/open-platform',
  },
  openGraph: {
    type: 'website',
    url: '/open-platform',
    title: '开发者仪表盘 Beta | Phigros Query',
    description: 'Phigros Query 开发者仪表盘 Beta：提供 GitHub 登录与 API Key 申请、轮换、撤销能力。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '开发者仪表盘 Beta | Phigros Query',
    description: 'Phigros Query 开发者仪表盘 Beta：提供 GitHub 登录与 API Key 申请、轮换、撤销能力。',
    images: ['/og'],
  },
};

export default function OpenPlatformPage() {
  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Phigros Query Open Platform Dashboard',
    url: `${SITE_URL}/open-platform`,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'CNY',
    },
  };

  return (
    <PageShell
      variant="plain"
      header={<SiteHeader />}
      mainClassName="px-3 py-4 sm:px-4 sm:py-6"
      containerClassName="mx-auto max-w-[1320px]"
      footerVariant="none"
      beforeMain={
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(softwareJsonLd) }}
        />
      }
    >
      <OpenPlatformBetaDashboard />
    </PageShell>
  );
}
