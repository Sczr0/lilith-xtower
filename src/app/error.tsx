'use client';

import { useEffect, useRef } from 'react';

import { PageShell } from './components/PageShell';
import { SiteHeader } from './components/SiteHeader';
import { FeedbackDialog } from './components/FeedbackDialog';
import { buttonStyles } from './components/ui/styles';
import { pushEvent, reportErrorToServer } from './lib/diagnostics/collector';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reportedRef = useRef(false);

  useEffect(() => {
    console.error('Unhandled error:', error);
    // 自动上报（带 session 去重），不打断用户重试流程
    if (reportedRef.current) return;
    reportedRef.current = true;
    pushEvent({
      t: Date.now(),
      type: 'error',
      message: error.message || 'Unknown error',
      stack: error.stack,
    });
    reportErrorToServer(error.message || 'Unknown error', error.stack, window.location.pathname);
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
        <div className="flex items-center justify-center gap-3">
          <button onClick={reset} className={buttonStyles({ variant: 'primary', size: 'lg' })}>
            重试
          </button>
          <FeedbackDialog
            variant="outline"
            label="反馈这个问题"
            initialError={{ message: error.message, stack: error.stack, digest: error.digest }}
          />
        </div>
      </div>
    </PageShell>
  );
}
