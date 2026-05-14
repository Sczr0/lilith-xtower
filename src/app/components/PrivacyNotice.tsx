'use client';

import { useState } from 'react';
import { BarChart3, X } from 'lucide-react';
import Link from 'next/link';
import { useClientValue } from '../hooks/useClientValue';

const DISMISS_KEY = 'privacy-notice-dismissed';

export function PrivacyNotice() {
  const dismissedByStorage = useClientValue(
    () => window.localStorage.getItem(DISMISS_KEY) === '1',
    true,
  );
  const [dismissed, setDismissed] = useState(false);

  if (dismissedByStorage || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {}
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 animate-slide-up"
      role="status"
      aria-label="数据与隐私说明"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-blue-50/95 dark:bg-blue-950/40 backdrop-blur-md border-t border-blue-200 dark:border-blue-800/60 text-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <BarChart3 className="h-4 w-4 flex-shrink-0 text-blue-500 dark:text-blue-400" aria-hidden="true" />
          <span className="text-blue-700 dark:text-blue-300 truncate">
            本站使用 Umami 统计服务以改进体验，不收集个人身份信息
          </span>
          <Link
            href="/privacy"
            className="flex-shrink-0 text-blue-600 dark:text-blue-400 underline decoration-dotted underline-offset-4 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
          >
            隐私协议
          </Link>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          aria-label="关闭数据说明"
        >
          <span className="text-xs font-medium">知道了</span>
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}