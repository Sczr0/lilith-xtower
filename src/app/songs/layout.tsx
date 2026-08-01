import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '曲目信息',
  description:
    'Phigros 全曲目定数表与曲目信息：各难度定数（EZ/HD/IN/AT）、曲师、画师与谱师，支持搜索、定数筛选与排序。',
  openGraph: {
    type: 'website',
    url: '/songs',
    title: '曲目信息 - 定数表 | Phigros Query',
    description:
      'Phigros 全曲目定数表与曲目信息：各难度定数（EZ/HD/IN/AT）、曲师、画师与谱师，支持搜索、定数筛选与排序。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
  },
  alternates: {
    canonical: '/songs',
  },
};

export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h1 className="sr-only">曲目信息</h1>
      {children}
    </>
  );
}
