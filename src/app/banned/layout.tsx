import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '账号已被全局封禁',
  description: '当前账号因违反用户协议已被全局封禁，页面提供封禁原因与申诉指引。',
  // 用户状态页：不应出现在搜索索引与社交预览中
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: 'website',
    url: '/banned',
    title: '账号已被全局封禁',
    description: '当前账号因违反用户协议已被全局封禁，页面提供封禁原因与申诉指引。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
  },
  alternates: {
    canonical: '/banned',
  },
};

export default function BannedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
