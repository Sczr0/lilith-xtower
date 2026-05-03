'use client';

import { useEffect } from 'react';
import { PageShell } from './components/PageShell';
import { SiteHeader } from './components/SiteHeader';
import { buttonStyles } from './components/ui/styles';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <PageShell
      variant="gradient"
      header={<SiteHeader />}
      mainClassName="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 min-h-[calc(100vh-8rem)]"
      containerClassName="w-full max-w-lg mx-auto text-center"
    >
      <div className="space-y-4">
        <p className="text-6xl font-bold text-red-600 dark:text-red-400">500</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">出错了</h1>
        <p className="text-gray-600 dark:text-gray-400">
          页面遇到了意外错误，请稍后重试。
        </p>
        <button onClick={reset} className={buttonStyles({ variant: 'primary', size: 'lg' })}>
          重试
        </button>
      </div>
    </PageShell>
  );
}
