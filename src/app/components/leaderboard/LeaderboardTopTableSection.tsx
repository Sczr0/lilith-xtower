'use client';

import type { LeaderboardTopItem } from '../../lib/types/leaderboard';
import { formatFixedNumber } from '../../lib/utils/number';
import { StyledSelect } from '../ui/Select';
import { buttonStyles, cardStyles, cx } from '../ui/styles';
import {
  getSpacerHeights,
  useVirtualRows,
  virtualItemStyle,
  VirtualSpacerRow,
  VIRTUAL_VIEWPORT_MAX_HEIGHT,
} from '../ui/virtualRows';
import { useIsDesktop } from '../../hooks/useIsDesktop';

type SelectOption = {
  label: string;
  value: string;
};

/**
 * 桌面端数据行高度（px），必须与 CSS 保证的真实行高严格相等：
 * py-3 上下内边距 24 + 排名徽章 36（h-9，行内最高元素）+ 分隔线 1 = 61。
 *
 * 这个值同时用作虚拟化的 estimateSize 与行的内联 height，两者不一致时虚拟化每测量到一行
 * 就改一次总高度，滚动过程中滚动条与下方内容持续位移（实测滚动 25 步 17221→17644px）。
 * 别名 / 用户标识 / 更新时间都靠 truncate 保证只有一行，改内边距 / 徽章尺寸时必须同步改这里。
 */
export const LEADERBOARD_TABLE_ROW_HEIGHT = 61;

/**
 * 列宽（百分比，合计 100%）。必须显式固定列宽（配合 table-fixed）：虚拟化只渲染可视窗口内的行，
 * 自动表格布局的列宽由「当前渲染出来的这些行」的内容算出——窗口一移动列宽就变
 * （实测 25 步内出现 15 组不同列宽），别名随之折行，行高在滚动中抖动。
 * 占比按最窄的桌面视口（768px，此时侧栏是抽屉、正文约 640px）反推：排名列要放得下
 * 36px 徽章 + px-4（68），RKS 列要放得下数值 + TOP 徽章（≈152），更新时间列要放得下完整时间（≈150）。
 */
const LEADERBOARD_COLUMNS = [11, 22, 19.5, 24, 23.5];

/** 数据单元格：分隔线必须落在单元格上（border-separate 不画 tr 边框），行高才恒为常量。 */
const LEADERBOARD_BODY_CELL = 'border-b border-gray-100/70 dark:border-neutral-800/70';

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
  // 桌面端表格虚拟化（榜单支持「加载更多」无限累加，全量渲染会越来越卡）
  // 行高固定为 LEADERBOARD_TABLE_ROW_HEIGHT，估算值与真实行高严格相等（见该常量注释）。
  const { scrollRef, virtualItems, totalSize, measureElement, scrollClassName } = useVirtualRows(
    topItems.length,
    LEADERBOARD_TABLE_ROW_HEIGHT,
  );
  // 移动端卡片列表虚拟化（卡片高度随视口变化，用首张卡片实测校准估算值）
  const {
    scrollRef: mobileScrollRef,
    virtualItems: mobileVirtualItems,
    totalSize: mobileTotalSize,
    measureElement: mobileMeasureElement,
    scrollClassName: mobileScrollClassName,
  } = useVirtualRows(topItems.length, 150, { cardList: true });
  const isDesktop = useIsDesktop();

  // 断点未确定（SSR 与 hydration 首帧）时两套都渲染，由 CSS 决定显隐；确定后只渲染一套。
  const desktopRows = isDesktop === false ? [] : virtualItems;
  const mobileRows = isDesktop === true ? [] : mobileVirtualItems;
  const { paddingTop, paddingBottom } = getSpacerHeights(
    desktopRows,
    desktopRows.length ? totalSize : 0,
  );
  const virtualRows = desktopRows.map((virtualItem) => ({
    virtualItem,
    item: topItems[virtualItem.index],
  }));
  const mobileVirtualRows = mobileRows.map((virtualItem) => ({
    virtualItem,
    item: topItems[virtualItem.index],
  }));

  return (
    <section className={cardStyles({ tone: 'glass-subtle', rounded: '2xl', padding: 'md', className: 'transition-colors' })}>
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

      {/* 移动端卡片列表（虚拟化，仅渲染可视卡片） */}
      <div
        ref={mobileScrollRef}
        className={cx('mt-4 md:hidden', mobileScrollClassName)}
        style={{ maxHeight: VIRTUAL_VIEWPORT_MAX_HEIGHT, position: 'relative' }}
      >
        {/* 撑出完整列表长度：卡片是绝对定位，不显式给出这段高度时滚动范围只会到
            「已渲染卡片的最低点」，滚动中不断变长；外层 maxHeight 会把自身高度压到 640。
            空列表时高度为 0，不影响下面内联的空态块。 */}
        <div style={{ height: mobileTotalSize }} aria-hidden="true" />
        {mobileVirtualRows.map(({ virtualItem, item }) => (
          <div
            key={`mobile-${item.rank}-${item.user}`}
            data-index={virtualItem.index}
            ref={mobileMeasureElement}
            style={virtualItemStyle(virtualItem.start)}
            className="mb-3 rounded-xl border border-gray-200 bg-white/80 p-4 transition-colors hover:border-blue-300 dark:border-neutral-700 dark:bg-neutral-900/60 dark:hover:border-blue-700/60"
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

      {/* 桌面端表格（虚拟化，仅渲染可视行） */}
      <div
        ref={scrollRef}
        className={cx('mt-4 hidden md:block', scrollClassName)}
        style={{ maxHeight: VIRTUAL_VIEWPORT_MAX_HEIGHT }}
      >
        {/*
          固定表格布局 + 显式列宽 + 固定行高 + border-separate：
          列宽只由 colgroup 决定，不随渲染了哪些行变化；分隔线画在单元格上，
          行高恒为 LEADERBOARD_TABLE_ROW_HEIGHT。
        */}
        <table className="min-w-full w-full table-fixed border-separate border-spacing-0 text-sm">
          <colgroup>
            {LEADERBOARD_COLUMNS.map((width, index) => (
              <col key={index} style={{ width: `${width}%` }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-white/80 text-xs uppercase tracking-wide text-gray-500 backdrop-blur-sm dark:bg-neutral-900/90 dark:text-gray-400">
            <tr>
              <th className="truncate border-b border-gray-200/70 px-4 py-3 text-left font-medium dark:border-neutral-800/70">
                排名
              </th>
              <th className="truncate border-b border-gray-200/70 px-4 py-3 text-left font-medium dark:border-neutral-800/70">
                玩家
              </th>
              <th className="truncate border-b border-gray-200/70 px-4 py-3 text-left font-medium dark:border-neutral-800/70">
                用户标识
              </th>
              <th className="truncate border-b border-gray-200/70 px-4 py-3 text-left font-medium dark:border-neutral-800/70">
                RKS
              </th>
              <th className="truncate border-b border-gray-200/70 px-4 py-3 text-left font-medium dark:border-neutral-800/70">
                更新时间
              </th>
            </tr>
          </thead>
          <tbody>
            <VirtualSpacerRow height={paddingTop} />
            {virtualRows.map(({ virtualItem, item }) => (
              <tr
                key={`desktop-${item.rank}-${item.user}`}
                data-index={virtualItem.index}
                ref={measureElement}
                style={{ height: LEADERBOARD_TABLE_ROW_HEIGHT }}
                className="bg-white/80 transition-colors hover:bg-blue-50/60 dark:bg-neutral-900/60 dark:hover:bg-blue-900/20"
              >
                <td className={cx(LEADERBOARD_BODY_CELL, 'truncate px-4 py-3')}>
                  <div className="flex items-center gap-2">{renderRankBadge(item.rank)}</div>
                </td>
                <td className={cx(LEADERBOARD_BODY_CELL, 'truncate px-4 py-3')}>
                  {item.alias ? (
                    <button
                      type="button"
                      onClick={() => onLookupAlias(item.alias ?? '')}
                      className="max-w-full truncate text-left text-sm font-medium text-gray-900 hover:text-blue-700 hover:underline dark:text-gray-100 dark:hover:text-blue-200"
                      title="点击查询公开档案"
                    >
                      {item.alias}
                    </button>
                  ) : (
                    <span className="truncate text-sm font-medium text-gray-400 dark:text-gray-500">
                      未设置别名
                    </span>
                  )}
                </td>
                <td className={cx(LEADERBOARD_BODY_CELL, 'truncate px-4 py-3')}>
                  <button
                    type="button"
                    onClick={() => onCopyUser(item.user)}
                    title="点击复制用户标识"
                    className="inline-flex max-w-full items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-neutral-800 dark:text-gray-300"
                  >
                    <span className="truncate font-mono">{`${item.user.substring(0, 8)}…`}</span>
                    <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </td>
                <td className={cx(LEADERBOARD_BODY_CELL, 'truncate px-4 py-3')}>
                  <div className="flex items-center gap-2">
                    <span className="truncate text-base font-semibold text-blue-600 dark:text-blue-400">
                      {formatFixedNumber(item.score, 4)}
                    </span>
                    {item.rank <= 3 && (
                      <span className="inline-flex shrink-0 items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-200">
                        TOP {item.rank}
                      </span>
                    )}
                  </div>
                </td>
                <td className={cx(LEADERBOARD_BODY_CELL, 'truncate px-4 py-3 text-xs text-gray-500 dark:text-gray-400')}>
                  {formatDateTime(item.updatedAt)}
                </td>
              </tr>
            ))}
            <VirtualSpacerRow height={paddingBottom} />

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
