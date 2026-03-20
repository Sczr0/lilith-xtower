import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '投稿与反馈中心 | Phigros Query 功能建议与问题上报',
  description:
    'Phigros Query 投稿与反馈中心，欢迎提交功能建议、Bug 反馈、内容勘误与体验意见，也可参与问卷调研帮助我们规划后续迭代方向。',
  keywords: ['Phigros', '投稿', '反馈', 'Phigros Query', '建议', 'Bug 反馈', '问卷'],
  openGraph: {
    type: 'website',
    url: '/contribute',
    title: '投稿与反馈中心 | Phigros Query 功能建议与问题上报',
    description:
      'Phigros Query 投稿与反馈中心，欢迎提交功能建议、Bug 反馈、内容勘误与体验意见，也可参与问卷调研帮助我们规划后续迭代方向。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og?title=投稿与反馈', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '投稿与反馈中心 | Phigros Query 功能建议与问题上报',
    description:
      'Phigros Query 投稿与反馈中心，欢迎提交功能建议、Bug 反馈、内容勘误与体验意见，也可参与问卷调研帮助我们规划后续迭代方向。',
    images: ['/og?title=投稿与反馈'],
  },
  alternates: {
    canonical: '/contribute',
  },
};

export default function ContributeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
