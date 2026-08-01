'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

  // 难度切换时，将当前 Tab 平滑滚动到可视区域（移动端横滑）
  const tabListRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [filter]);

  const isAll = filter === 'ALL';

  return (
    <div className={cardStyles({ className: 'space-y-4 p-4 sm:p-6' })}>
      {/* 难度切换 + 统计（支持横向滑动） */}
      <div className="flex flex-col gap-3">
        <div
          ref={tabListRef}
          role="tablist"
          aria-label="选择难度"
          className="flex gap-1.5 overflow-x-auto hide-scrollbar scroll-smooth snap-x -mx-1 px-1 py-0.5"
        >
          {FILTERS.map((item) => {
            const active = filter === item;
            return (
              <button
                key={item}
                ref={active ? activeTabRef : undefined}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setFilter(item)}
                className={cx(
                  'shrink-0 snap-start px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors border',
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
              </button>
            );
          })}
        </div>
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
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm outline-none focus:ring-2 focus:ring-blue-500"
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
          {/* 移动端：卡片列表 */}
          <div key={`${filter}-cards`} className="md:hidden space-y-2.5 animate-info-fade">
            {filtered.map((song) => {
              const highest = displayLevelForFilter(song, filter) as number;
              const highlight = highest >= 15;
              return (
                <div
                  key={song.id}
                  className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3.5 space-y-2"
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

          {/* 桌面端：表格 */}
          <div key={`${filter}-table`} className="hidden md:block overflow-x-auto -mx-4 sm:mx-0 animate-info-fade">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-neutral-700">
                  <th className="px-4 py-2 font-medium">曲目/曲目ID</th>
                  <th className="px-4 py-2 font-medium">曲师</th>
                  <th className="px-4 py-2 font-medium hidden md:table-cell">画师</th>
                  {isAll ? (
                    (['EZ', 'HD', 'IN', 'AT'] as Difficulty[]).map((diff) => (
                      <th key={diff} className="px-2 py-2 font-medium text-center">
                        {diff}
                      </th>
                    ))
                  ) : (
                    <th className="px-4 py-2 font-medium text-right">{filter} 定数</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((song) => {
                  const highest = displayLevelForFilter(song, filter) as number;
                  const highlight = highest >= 15;
                  return (
                    <tr
                      key={song.id}
                      className="border-b border-gray-100 dark:border-neutral-800/70 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{song.name}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">{song.id}</div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{song.composer || '-'}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 hidden md:table-cell">
                        {song.illustrator || '-'}
                      </td>
                      {isAll ? (
                        (['EZ', 'HD', 'IN', 'AT'] as Difficulty[]).map((diff) => {
                          const level = getSongLevel(song, diff);
                          return (
                            <td key={diff} className="px-2 py-2.5 text-center">
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
                        <td className="px-4 py-2.5 text-right">
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
