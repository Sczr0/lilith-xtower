import Link from 'next/link';
import type { Metadata } from 'next';
import { PageShell } from './components/PageShell';
import { SiteHeader } from './components/SiteHeader';
import { buttonStyles } from './components/ui/styles';

// 404 页面不应被搜索引擎索引
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function NotFound() {
  return (
    <PageShell
      variant="gradient"
      header={<SiteHeader />}
      mainClassName="relative z-10 flex-1 p-4 sm:p-6 lg:p-8"
      containerClassName="max-w-4xl mx-auto"
    >
      <div className="text-center space-y-6 py-16">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-gray-100">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300">页面未找到</h2>
        <p className="text-gray-600 dark:text-gray-400">抱歉，您访问的页面不存在。</p>
        <Link href="/" className={buttonStyles({ variant: 'primary' })}>
          返回首页
        </Link>
      </div>
    </PageShell>
  );
}
