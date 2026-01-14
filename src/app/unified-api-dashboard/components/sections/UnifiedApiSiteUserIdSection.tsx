'use client';

import { buttonStyles, cardStyles } from '../../../components/ui/styles';
import type { AsyncState } from '../../lib/unifiedApiDashboardUtils';

interface UnifiedApiSiteUserIdSectionProps {
  siteUserIdState: AsyncState<string>;
  copyText: (value: string, label?: string) => Promise<void>;
}

export function UnifiedApiSiteUserIdSection({ siteUserIdState, copyText }: UnifiedApiSiteUserIdSectionProps) {
  return (
    <section className={cardStyles({ tone: 'glass' })}>
      <h2 className="text-lg font-semibold mb-2">本站识别码（匿名）</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        登录后，本站会生成一个稳定的匿名识别码，用来在联合API中识别你（不包含昵称等信息）。
      </p>

      <div className="mt-4">
        {siteUserIdState.loading ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">生成中...</p>
        ) : siteUserIdState.error ? (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
            {siteUserIdState.error}
          </div>
        ) : siteUserIdState.data ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-neutral-950/30 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-gray-500 dark:text-gray-400">userId</div>
                <div className="mt-1 font-mono text-sm break-all">{siteUserIdState.data}</div>
              </div>
              <button
                type="button"
                className={buttonStyles({ variant: 'outline', size: 'sm' })}
                onClick={() => void copyText(siteUserIdState.data || '', 'userId')}
                disabled={!siteUserIdState.data}
              >
                复制
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">绑定时会自动使用固定的平台标识（无需修改）。</div>
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">暂无数据</p>
        )}
      </div>
    </section>
  );
}

