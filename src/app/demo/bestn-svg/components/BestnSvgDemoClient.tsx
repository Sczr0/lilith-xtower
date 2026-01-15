'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { BnImageGenerator } from '../../../components/BnImageGenerator';
import { RotatingTips } from '../../../components/RotatingTips';
import { useAuth } from '../../../contexts/AuthContext';
import { buttonStyles, cardStyles } from '../../../components/ui/styles';

interface BestnSvgDemoClientProps {
  debugExport: boolean;
}

export function BestnSvgDemoClient({ debugExport }: BestnSvgDemoClientProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // 说明：与 /dashboard、/unified-api-dashboard 保持一致 —— 未登录时软跳转到 /login
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className={cardStyles({ tone: 'glass' })}>
        <div className="flex flex-col items-center justify-center py-10" role="status" aria-live="polite">
          <span className="sr-only">正在检查登录状态…</span>
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" aria-hidden="true" />
          <div className="mt-3">
            <RotatingTips />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className={cardStyles({ tone: 'glass' })}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">需要登录</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">该 demo 需要登录凭证，正在跳转到登录页…</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/login" className={buttonStyles({ variant: 'primary', size: 'sm' })}>
            去登录
          </Link>
          <Link href="/" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
            返回首页
          </Link>
        </div>
      </section>
    );
  }

  return (
    <BnImageGenerator
      showTitle={false}
      showDescription={false}
      format="svg"
      showSvgSource
      debugExport={debugExport}
    />
  );
}

