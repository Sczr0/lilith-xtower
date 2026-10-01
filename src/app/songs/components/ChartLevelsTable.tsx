'use client';

import { useMemo, useState } from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search } from 'lucide-react';

import type { Difficulty } from '@/app/lib/constants/difficultyColors';
import {
  DIFFICULTY_BADGE,
  DIFFICULTY_TEXT,
} from '@/app/lib/constants/difficultyColors';
import type { SongInfo } from '@/app/lib/info/csv';
import {
  displayLevelForFilter,
  getSongLevel,
  matchLevelRange,
} from '@/app/lib/info/csv';
import { cardStyles, cx } from '../../components/ui/styles';
import { RadioGroup } from '../../components/ui/RadioGroup';
import {
  getSpacerHeights,
  useVirtualRows,
  virtualItemStyle,
  VirtualSpacerRow,
  VIRTUAL_VIEWPORT_MAX_HEIGHT,
} from '../../components/ui/virtualRows';
import { useIsDesktop } from '../../hooks/useIsDesktop';

/** 难度筛选：'ALL' = 全部难度混排；否则为单一难度。 */
type DifficultyFilter = Difficulty | 'ALL';

const FILTERS: DifficultyFilter[] = ['ALL', 'EZ', 'HD', 'IN', 'AT'];

const FILTER_LABEL: Record<DifficultyFilter, string> = {
  ALL: '全部',
  EZ: 'EZ',
  HD: 'HD',
  IN: 'IN',
  AT: 'AT',
};

/** 定数表最低/最高参考值（用于可视条比例，覆盖全难度范围）。 */
const LEVEL_SCALE_MIN = 0;
const LEVEL_SCALE_MAX = 17;

type SortDirection = 'desc' | 'asc';

/**
 * 桌面端数据行高度（px），必须与 CSS 保证的真实行高严格相等：
 * py-2.5 上下内边距 20 + 曲名 20（text-sm 行高）+ 曲目ID 16（text-xs 行高）+ 分隔线 1 = 57。
 *
 * 这个值同时用作虚拟化的 estimateSize 与行的内联 height。两者不一致时，虚拟化每测量到一行
 * 就改一次总高度，滚动过程中滚动条与下方内容持续位移（实测滚动 25 步内容高度 17253→17952px）。
 * 曲名 / 曲师 / 画师都靠 truncate 保证只有一行，改内边距 / 字号 / 行数时必须同步改这里。
 */
export const CHART_LEVELS_ROW_HEIGHT = 57;

/**
 * 列宽（百分比，两种筛选下列数不同，合计 100%）。
 *
 * 必须显式固定列宽（配合 table-fixed）：虚拟化只渲染可视窗口内的行，而自动表格布局的列宽
 * 由「当前渲染出来的这些行」的内容算出——窗口一移动列宽就变（实测 25 步内出现 17 组不同列宽），
 * 曲名/曲师随之折行变化，行高在滚动中跳 4~32px。
 * 「全部」= 曲目/曲师/画师 + EZ/HD/IN/AT；单难度 = 曲目/曲师/画师 + 定数（带可视条，需要更宽）。
 * 难度列占比按最窄桌面视口（正文约 640px）反推：定数徽章 min-w-12 + px-2 需要 64px，
 * 单难度列还带 min-w-24 的可视条 + 徽章，需要 ≈154px。
 */
const CHART_LEVELS_COLUMNS_ALL = [29, 15, 14, 10.5, 10.5, 10.5, 10.5];
const CHART_LEVELS_COLUMNS_SINGLE = [34, 22, 18, 26];

/** 数据单元格：分隔线必须落在单元格上（border-separate 不画 tr 边框），行高才恒为常量。 */
const CHART_LEVELS_BODY_CELL = 'border-b border-gray-100 dark:border-neutral-800/70';

export function ChartLevelsTable({ songs }: { songs: SongInfo[] }) {
  const [filter, setFilter] = useState<DifficultyFilter>('ALL');
  const [query, setQuery] = useState('');
  const [minLevel, setMinLevel] = useState('');
  const [maxLevel, setMaxLevel] = useState('');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    const min = minLevel === '' ? null : Number(minLevel);
    const max = maxLevel === '' ? null : Number(maxLevel);

    return songs
      .filter((song) => {
        if (displayLevelForFilter(song, filter) === null) return false;
        if (q && !`${song.name} ${song.composer} ${song.id}`.toLowerCase().includes(q)) return false;
        if (!matchLevelRange(song, filter, min, max)) return false;
        return true;
      })
      .sort((a, b) => {
        const levelA = displayLevelForFilter(a, filter) as number;
        const levelB = displayLevelForFilter(b, filter) as number;
        if (levelA !== levelB) {
          return sortDir === 'desc' ? levelB - levelA : levelA - levelB;
        }
        return a.name.localeCompare(b.name, 'zh-Hans-CN');
      });
  }, [songs, filter, q, minLevel, maxLevel, sortDir]);

  const stats = useMemo(() => {
    if (filter === 'ALL') {
      const withLevel = songs.filter((song) => displayLevelForFilter(song, 'ALL') !== null);
      let max: number | null = null;
      for (const song of withLevel) {
        const levels = [song.ez, song.hd, song.in, song.at].filter(
          (level): level is number => level !== null,
        );
        const songMax = Math.max(...levels);
        if (max === null || songMax > max) max = songMax;
      }
      return { count: withLevel.length, max };
    }

    const levels = songs
      .map((song) => getSongLevel(song, filter))
      .filter((level): level is number => level !== null);
    if (levels.length === 0) return { count: 0, max: null };
    return {
      count: levels.length,
      max: Math.max(...levels),
    };
  }, [songs, filter]);

  const barWidth = (level: number) => {
    const ratio = Math.min(1, Math.max(0, (level - LEVEL_SCALE_MIN) / (LEVEL_SCALE_MAX - LEVEL_SCALE_MIN)));
    return `${Math.round(ratio * 100)}%`;
  };

  const isAll = filter === 'ALL';

  // 桌面端表格虚拟化：仅渲染可视行（筛选/输入时不再重排数百行 DOM）
  // 行高固定为 CHART_LEVELS_ROW_HEIGHT，估算值与真实行高严格相等（见该常量注释）。
  const { scrollRef, virtualItems, totalSize, measureElement, scrollClassName } = useVirtualRows(
    filtered.length,
    CHART_LEVELS_ROW_HEIGHT,
  );

  // 移动端卡片列表虚拟化（卡片高度随视口变化，用首张卡片实测校准估算值）
  const {
    scrollRef: mobileScrollRef,
    virtualItems: mobileVirtualItems,
    totalSize: mobileTotalSize,
    measureElement: mobileMeasureElement,
    scrollClassName: mobileScrollClassName,
  } = useVirtualRows(filtered.length, 190, { cardList: true });

  // 断点未确定（SSR 与 hydration 首帧）时两套都渲染，由 CSS（md:hidden / hidden md:block）
  // 决定显隐；确定后只渲染对应的一套，避免重复 DOM 与多余的虚拟化行。
  const isDesktop = useIsDesktop();
  const desktopRows = isDesktop === false ? [] : virtualItems;
  const mobileRows = isDesktop === true ? [] : mobileVirtualItems;
  const { paddingTop, paddingBottom } = getSpacerHeights(
    desktopRows,
    desktopRows.length ? totalSize : 0,
  );

  return (
    <div className={cardStyles({ className: 'space-y-4 p-4 sm:p-6' })}>
      {/* 难度切换 + 统计（窄屏自动换行，不隐藏选项） */}
      <div className="flex flex-col gap-3">
        <RadioGroup.Root
          aria-label="选择难度"
          orientation="horizontal"
          value={filter}
          onValueChange={(value) => setFilter(value as DifficultyFilter)}
          className="flex flex-wrap gap-1.5"
        >
          {FILTERS.map((item) => {
            const active = filter === item;
            return (
              <RadioGroup.Item
                key={item}
                value={item}
                className={cx(
                  'px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors border',
                  item === 'ALL'
                    ? active
                      ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900 border-transparent'
                      : 'text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-neutral-800'
                    : active
                      ? DIFFICULTY_BADGE[item]
                      : 'text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-neutral-800',
                )}
              >
                {FILTER_LABEL[item]}
              </RadioGroup.Item>
            );
          })}
        </RadioGroup.Root>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {stats.count} 首 · 最高 {stats.max?.toFixed(1) ?? '-'}
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <label className="relative flex-1 min-w-0">
          <span className="sr-only">搜索曲目</span>
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索曲名 / 曲师 / ID"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-base sm:text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            定数
            <input
              type="number"
              value={minLevel}
              onChange={(event) => setMinLevel(event.target.value)}
              placeholder="最小"
              step="0.1"
              min="0"
              max="17"
              aria-label="最小定数"
              className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-base sm:text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <span className="text-gray-400">~</span>
          <input
            type="number"
            value={maxLevel}
            onChange={(event) => setMaxLevel(event.target.value)}
            placeholder="最大"
            step="0.1"
            min="0"
            max="17"
            aria-label="最大定数"
            className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-base sm:text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setSortDir((dir) => (dir === 'desc' ? 'asc' : 'desc'))}
            aria-label={sortDir === 'desc' ? '当前降序，点击切换为升序' : '当前升序，点击切换为降序'}
            title={sortDir === 'desc' ? '定数降序' : '定数升序'}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
          >
            {sortDir === 'desc' ? (
              <ArrowDownWideNarrow className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ArrowUpNarrowWide className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* 结果：key 跟随筛选变化，切换时触发滑动淡入动画 */}
      {filtered.length === 0 ? (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">没有符合条件的曲目，试试调整筛选条件。</p>
      ) : (
        <>
          {/* 移动端：卡片列表（虚拟化，仅渲染可视卡片） */}
          <div
            key={`${filter}-cards`}
            ref={mobileScrollRef}
            className={cx('md:hidden animate-info-fade', mobileScrollClassName)}
            style={{ maxHeight: VIRTUAL_VIEWPORT_MAX_HEIGHT, position: 'relative' }}
          >
            {/* 撑出完整列表长度：卡片是绝对定位，不显式给出这段高度时滚动范围只会到
                「已渲染卡片的最低点」，滚动中不断变长；外层 maxHeight 会把自身高度压到 640。 */}
            <div style={{ height: mobileTotalSize }} aria-hidden="true" />
            {mobileRows.map((virtualItem) => {
              const song = filtered[virtualItem.index];
              const highest = displayLevelForFilter(song, filter) as number;
              const highlight = highest >= 15;
              return (
                <div
                  key={song.id}
                  data-index={virtualItem.index}
                  ref={mobileMeasureElement}
                  style={virtualItemStyle(virtualItem.start)}
                  className="mb-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3.5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{song.name}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 break-all">{song.id}</div>
                    </div>
                    {!isAll && (
                      <span
                        className={cx(
                          'inline-block min-w-12 text-center px-2 py-0.5 rounded-md font-semibold tabular-nums shrink-0',
                          DIFFICULTY_BADGE[filter],
                          highlight && 'ring-2 ring-red-400/60 dark:ring-red-500/50',
                        )}
                      >
                        {highest.toFixed(1)}
                      </span>
                    )}
                  </div>
                  {isAll ? (
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['EZ', 'HD', 'IN', 'AT'] as Difficulty[]).map((diff) => {
                        const level = getSongLevel(song, diff);
                        return (
                          <div
                            key={diff}
                            className="rounded-lg bg-gray-100/80 dark:bg-neutral-800/60 px-1 py-1 text-center"
                          >
                            <div className="text-[10px] text-gray-400 dark:text-gray-500">{diff}</div>
                            <div
                              className={cx(
                                'text-sm font-semibold tabular-nums',
                                level !== null
                                  ? DIFFICULTY_TEXT[diff]
                                  : 'text-gray-300 dark:text-gray-600',
                              )}
                            >
                              {level !== null ? level.toFixed(1) : '-'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {filter} 定数 {highest.toFixed(1)}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {song.composer || '-'} · {song.illustrator || '-'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 桌面端：表格（虚拟化，仅渲染可视行） */}
          <div
            key={`${filter}-table`}
            ref={scrollRef}
            className={cx('hidden md:block animate-info-fade', scrollClassName)}
            style={{ maxHeight: VIRTUAL_VIEWPORT_MAX_HEIGHT }}
          >
            {/*
              固定表格布局 + 显式列宽 + 固定行高 + border-separate：
              列宽只由 colgroup 决定，不随渲染了哪些行变化；分隔线画在单元格上，
              行高恒为 CHART_LEVELS_ROW_HEIGHT（border-collapse 的共用边框会产生 0.5px 零头）。
            */}
            <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
              <colgroup>
                {(isAll ? CHART_LEVELS_COLUMNS_ALL : CHART_LEVELS_COLUMNS_SINGLE).map((width, index) => (
                  <col key={index} style={{ width: `${width}%` }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10 bg-white dark:bg-neutral-900">
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                  <th className="truncate border-b border-gray-200 px-4 py-2 font-medium dark:border-neutral-700">
                    曲目/曲目ID
                  </th>
                  <th className="truncate border-b border-gray-200 px-4 py-2 font-medium dark:border-neutral-700">
                    曲师
                  </th>
                  <th className="truncate border-b border-gray-200 px-4 py-2 font-medium dark:border-neutral-700">
                    画师
                  </th>
                  {isAll ? (
                    (['EZ', 'HD', 'IN', 'AT'] as Difficulty[]).map((diff) => (
                      <th
                        key={diff}
                        className="truncate border-b border-gray-200 px-2 py-2 text-center font-medium dark:border-neutral-700"
                      >
                        {diff}
                      </th>
                    ))
                  ) : (
                    <th className="truncate border-b border-gray-200 px-4 py-2 text-right font-medium dark:border-neutral-700">
                      {filter} 定数
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                <VirtualSpacerRow height={paddingTop} />
                {desktopRows.map((virtualItem) => {
                  const song = filtered[virtualItem.index];
                  const highest = displayLevelForFilter(song, filter) as number;
                  const highlight = highest >= 15;
                  return (
                    <tr
                      key={song.id}
                      data-index={virtualItem.index}
                      ref={measureElement}
                      style={{ height: CHART_LEVELS_ROW_HEIGHT }}
                      className="hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      <td className={cx(CHART_LEVELS_BODY_CELL, 'px-4 py-2.5')}>
                        <div className="truncate font-medium text-gray-900 dark:text-gray-100" title={song.name}>
                          {song.name}
                        </div>
                        <div className="truncate text-xs text-gray-400 dark:text-gray-500">{song.id}</div>
                      </td>
                      <td
                        className={cx(CHART_LEVELS_BODY_CELL, 'truncate px-4 py-2.5 text-gray-600 dark:text-gray-400')}
                        title={song.composer || '-'}
                      >
                        {song.composer || '-'}
                      </td>
                      <td
                        className={cx(
                          CHART_LEVELS_BODY_CELL,
                          'hidden truncate px-4 py-2.5 text-gray-600 md:table-cell dark:text-gray-400',
                        )}
                        title={song.illustrator || '-'}
                      >
                        {song.illustrator || '-'}
                      </td>
                      {isAll ? (
                        (['EZ', 'HD', 'IN', 'AT'] as Difficulty[]).map((diff) => {
                          const level = getSongLevel(song, diff);
                          return (
                            <td key={diff} className={cx(CHART_LEVELS_BODY_CELL, 'truncate px-2 py-2.5 text-center')}>
                              {level !== null ? (
                                <span
                                  className={cx(
                                    'inline-block min-w-12 text-center px-2 py-0.5 rounded-md font-semibold tabular-nums',
                                    DIFFICULTY_BADGE[diff],
                                  )}
                                >
                                  {level.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-gray-300 dark:text-gray-600">-</span>
                              )}
                            </td>
                          );
                        })
                      ) : (
                        <td className={cx(CHART_LEVELS_BODY_CELL, 'truncate px-4 py-2.5 text-right')}>
                          <div className="flex items-center justify-end gap-2.5 min-w-24">
                            <span className="hidden sm:inline-block w-16 h-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                              <span
                                className={cx('block h-full rounded-full', DIFFICULTY_TEXT[filter])}
                                style={{ width: barWidth(highest), backgroundColor: 'currentColor' }}
                              />
                            </span>
                            <span
                              className={cx(
                                'inline-block min-w-12 text-center px-2 py-0.5 rounded-md font-semibold tabular-nums',
                                DIFFICULTY_BADGE[filter],
                                highlight && 'ring-2 ring-red-400/60 dark:ring-red-500/50',
                              )}
                            >
                              {highest.toFixed(1)}
                            </span>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                <VirtualSpacerRow height={paddingBottom} />
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        共显示 {filtered.length} / {songs.length} 首曲目
      </p>
    </div>
  );
}
