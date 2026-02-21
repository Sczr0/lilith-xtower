'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { BANNED_DETAIL_KEY } from '../lib/constants/storageKeys';

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
    <main className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 dark:from-gray-950 dark:via-gray-900 dark:to-red-950 flex items-center justify-center p-6">
      <section className="w-full max-w-lg rounded-2xl border border-rose-200/70 dark:border-rose-900/50 bg-white/90 dark:bg-gray-900/80 shadow-xl p-8 text-center space-y-5">
        <h1 className="text-2xl md:text-3xl font-bold text-rose-700 dark:text-rose-300">账号已被封禁</h1>
        <p className="text-sm md:text-base text-gray-700 dark:text-gray-200">{detail}</p>
        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
          如需申诉，请联系管理员并提供账号信息与时间。
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-rose-300 dark:border-rose-700 px-4 py-2 text-sm font-medium text-rose-700 dark:text-rose-200 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
          >
            返回首页
          </Link>
        </div>
      </section>
    </main>
  );
}
