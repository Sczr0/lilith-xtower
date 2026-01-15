import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '投稿与反馈 - Phigros Query',
  description: '投稿与反馈入口：分享你的创意，或帮助我们改进 Phigros Query 的功能与体验。',
  keywords: ['Phigros', '投稿', '反馈', 'Phigros Query', '建议', 'Bug 反馈', '问卷'],
  openGraph: {
    type: 'website',
    url: '/contribute',
    title: '投稿与反馈 - Phigros Query',
    description: '投稿与反馈入口：分享你的创意，或帮助我们改进 Phigros Query 的功能与体验。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og?title=投稿与反馈', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '投稿与反馈 - Phigros Query',
    description: '投稿与反馈入口：分享你的创意，或帮助我们改进 Phigros Query 的功能与体验。',
    images: ['/og?title=投稿与反馈'],
  },
  alternates: {
    canonical: '/contribute',
  },
};

export default function ContributeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
