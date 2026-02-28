'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { BANNED_DETAIL_KEY } from '../lib/constants/storageKeys';
import { PageShell } from '../components/PageShell';
import { SiteHeader } from '../components/SiteHeader';
import { buttonStyles } from '../components/ui/styles';

const DEFAULT_DETAIL = '用户已被全局封禁';

export default function BannedPage() {
  const [detail, setDetail] = useState(DEFAULT_DETAIL);

  useEffect(() => {
    const stored = sessionStorage.getItem(BANNED_DETAIL_KEY);
    if (stored?.trim()) {
      setDetail(stored.trim());
    }
  }, []);

  return (
    <PageShell
      variant="gradient"
      header={<SiteHeader />}
      footerVariant="none"
      mainClassName="flex min-h-[calc(100vh-8rem)] items-center justify-center p-6"
      containerClassName="mx-auto w-full max-w-lg"
    >
      <section className="w-full rounded-2xl border border-rose-200/70 dark:border-rose-900/50 bg-white/90 dark:bg-gray-900/80 shadow-xl p-8 text-center space-y-5">
        <h1 className="text-2xl md:text-3xl font-bold text-rose-700 dark:text-rose-300">账号已被封禁</h1>
        <p className="text-sm md:text-base text-gray-700 dark:text-gray-200">{detail}</p>
        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
          如需申诉，请联系管理员并提供账号信息与时间。
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className={buttonStyles({
              variant: 'outline',
              className: 'border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-200 dark:hover:bg-rose-900/30 hover:bg-rose-50',
            })}
          >
            返回首页
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
