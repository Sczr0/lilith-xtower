'use client';

import type { LeaderboardTopItem } from '../../lib/types/leaderboard';
import { formatFixedNumber } from '../../lib/utils/number';
import { StyledSelect } from '../ui/Select';
import { buttonStyles } from '../ui/styles';

type SelectOption = {
  label: string;
  value: string;
};

function renderRankBadge(rank: number) {
  const base =
    'inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold';
  if (rank === 1) {
    return (
      <span className={`${base} border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-200`}>
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className={`${base} border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/50 dark:bg-slate-500/15 dark:text-slate-200`}>
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className={`${base} border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/50 dark:bg-orange-500/15 dark:text-orange-200`}>
        3
      </span>
    );
  }
  return (
    <span className={`${base} border-gray-200 bg-white text-gray-600 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-gray-300`}>
      #{rank}
    </span>
  );
}

interface LeaderboardTopTableSectionProps {
  topItems: LeaderboardTopItem[];
  topTotal: number | null;
  isTopLoading: boolean;
  topError: string | null;
  topPageSize: number;
  topPageSizeOptions: SelectOption[];
  canLoadMore: boolean;
  copyHint: string | null;
  onTopPageSizeChange: (value: string) => void;
  onRefreshTop: () => void;
  onLoadMore: () => void;
  onLookupAlias: (alias: string) => void;
  onCopyUser: (user: string) => void;
  onScrollToTop: () => void;
  formatDateTime: (value: string) => string;
}

export function LeaderboardTopTableSection({
  topItems,
  topTotal,
  isTopLoading,
  topError,
  topPageSize,
  topPageSizeOptions,
  canLoadMore,
  copyHint,
  onTopPageSizeChange,
  onRefreshTop,
  onLoadMore,
  onLookupAlias,
  onCopyUser,
  onScrollToTop,
  formatDateTime,
}: LeaderboardTopTableSectionProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm shadow-gray-100/40 backdrop-blur-sm transition-colors dark:border-neutral-800 dark:bg-neutral-900/50 dark:shadow-none">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 sm:text-xl">
            RKS 榜单
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            参考全站最新同步的玩家成绩，数据每次操作实时刷新
          </p>
          {copyHint && <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{copyHint}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white/60 px-3 py-2 text-xs text-gray-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-gray-300">
            <span className="font-medium">每次加载</span>
            <div className="w-28">
              <StyledSelect
                size="sm"
                value={String(topPageSize)}
                onValueChange={onTopPageSizeChange}
                options={topPageSizeOptions}
                disabled={isTopLoading}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onRefreshTop}
            disabled={isTopLoading}
            className={buttonStyles({ variant: 'secondary' })}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 4v5h.582m15.356 2a8.001 8.001 0 00-15.356-2m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            刷新榜单
          </button>
          <button
            type="button"
            onClick={onLoadMore}
            disabled={!canLoadMore || isTopLoading}
            className={buttonStyles({ variant: 'primary' })}
          >
            {isTopLoading ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" role="img">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
                  />
                </svg>
                同步中…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                加载更多
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span>
          已加载 {topItems.length.toLocaleString()}
          {topTotal !== null ? ` / ${topTotal.toLocaleString()}` : ''} 名玩家
        </span>
        {topError ? null : isTopLoading ? (
          <span>正在获取最新数据…</span>
        ) : (
          <span>榜单按 RKS 分数降序排列</span>
        )}
      </div>

      {topError && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
          {topError}
        </div>
      )}

      {/* 移动端卡片列表 */}
      <div className="mt-4 space-y-3 md:hidden">
        {topItems.map((item) => (
          <div
            key={`mobile-${item.rank}-${item.user}`}
            className="rounded-xl border border-gray-200 bg-white/80 p-4 transition-colors hover:border-blue-300 dark:border-neutral-700 dark:bg-neutral-900/60 dark:hover:border-blue-700/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {renderRankBadge(item.rank)}
                <div className="min-w-0 flex-1">
                  {item.alias ? (
                    <button
                      type="button"
                      onClick={() => onLookupAlias(item.alias ?? '')}
                      className="text-left text-sm font-medium truncate text-gray-900 hover:text-blue-700 hover:underline dark:text-gray-100 dark:hover:text-blue-200"
                      title="点击查询公开档案"
                    >
                      {item.alias}
                    </button>
                  ) : (
                    <p className="text-sm font-medium truncate text-gray-400 dark:text-gray-500">
                      未设置别名
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => onCopyUser(item.user)}
                    title="点击复制用户标识"
                    className="mt-1 inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-neutral-800 dark:text-gray-300"
                  >
                    <span className="font-mono">{`${item.user.substring(0, 8)}…`}</span>
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  {formatFixedNumber(item.score, 4)}
                </p>
                {item.rank <= 3 && (
                  <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-200">
                    TOP {item.rank}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>最近同步 {formatDateTime(item.updatedAt)}</span>
            </div>
          </div>
        ))}

        {topItems.length === 0 && !isTopLoading && !topError && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white/60 px-4 py-12 text-center text-sm text-gray-500 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-gray-400">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 17v-6m6 6V5M5 21h14M13 13l2-2m0 0l2 2m-2-2v8"
              />
            </svg>
            暂无排行榜数据，请稍后重试
          </div>
        )}
      </div>

      {/* 桌面端表格 */}
      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <tr className="border-b border-gray-200/70 dark:border-neutral-800/70">
              <th className="px-4 py-3 text-left font-medium">排名</th>
              <th className="px-4 py-3 text-left font-medium">玩家</th>
              <th className="px-4 py-3 text-left font-medium">用户标识</th>
              <th className="px-4 py-3 text-left font-medium">RKS</th>
              <th className="px-4 py-3 text-left font-medium">更新时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100/70 dark:divide-neutral-800/70">
            {topItems.map((item) => (
              <tr
                key={`desktop-${item.rank}-${item.user}`}
                className="bg-white/80 transition-colors hover:bg-blue-50/60 dark:bg-neutral-900/60 dark:hover:bg-blue-900/20"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">{renderRankBadge(item.rank)}</div>
                </td>
                <td className="px-4 py-3">
                  {item.alias ? (
                    <button
                      type="button"
                      onClick={() => onLookupAlias(item.alias ?? '')}
                      className="text-left text-sm font-medium text-gray-900 hover:text-blue-700 hover:underline dark:text-gray-100 dark:hover:text-blue-200"
                      title="点击查询公开档案"
                    >
                      {item.alias}
                    </button>
                  ) : (
                    <span className="text-sm font-medium text-gray-400 dark:text-gray-500">
                      未设置别名
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onCopyUser(item.user)}
                    title="点击复制用户标识"
                    className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-neutral-800 dark:text-gray-300"
                  >
                    <span className="font-mono">{`${item.user.substring(0, 8)}…`}</span>
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-blue-600 dark:text-blue-400">
                      {formatFixedNumber(item.score, 4)}
                    </span>
                    {item.rank <= 3 && (
                      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-200">
                        TOP {item.rank}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                  {formatDateTime(item.updatedAt)}
                </td>
              </tr>
            ))}

            {topItems.length === 0 && !isTopLoading && !topError && (
              <tr>
                <td colSpan={5} className="px-4 py-12">
                  <div className="flex flex-col items-center justify-center gap-2 text-center text-sm text-gray-500 dark:text-gray-400">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 17v-6m6 6V5M5 21h14M13 13l2-2m0 0l2 2m-2-2v8"
                      />
                    </svg>
                    暂无排行榜数据，请稍后重试
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onLoadMore}
          disabled={!canLoadMore || isTopLoading}
          className={buttonStyles({ variant: 'primary' })}
        >
          {isTopLoading ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" role="img">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
                />
              </svg>
              同步中…
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              加载更多
            </>
          )}
        </button>
        <button type="button" onClick={onScrollToTop} className={buttonStyles({ variant: 'secondary' })}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
          回到上方功能
        </button>
      </div>
    </section>
  );
}
