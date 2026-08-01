'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import type { Difficulty } from '@/app/lib/constants/difficultyColors';
import { DIFFICULTY_BADGE } from '@/app/lib/constants/difficultyColors';
import type { SongInfo } from '@/app/lib/info/csv';
import { cardStyles, cx } from '../../components/ui/styles';

const DIFFICULTIES: Difficulty[] = ['EZ', 'HD', 'IN', 'AT'];

/** Difficulty → 谱师字段名（EZ → chartEz，避免与全大写常量混淆）。 */
const DESIGNER_FIELD: Record<Difficulty, 'chartEz' | 'chartHd' | 'chartIn' | 'chartAt'> = {
  EZ: 'chartEz',
  HD: 'chartHd',
  IN: 'chartIn',
  AT: 'chartAt',
};

export function SongInfoTable({ songs }: { songs: SongInfo[] }) {
  const [query, setQuery] = useState('');
  const [selectedDiff, setSelectedDiff] = useState<Difficulty>('IN');

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return songs;
    return songs.filter((song) =>
      `${song.name} ${song.composer} ${song.illustrator} ${song.id}`
        .toLowerCase()
        .includes(q),
    );
  }, [songs, q]);

  return (
    <div className={cardStyles({ className: 'space-y-4 p-4 sm:p-6' })}>
      {/* 搜索 + 谱师难度切换：谱师列折叠为单列，避免表格过宽 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <label className="relative flex-1 min-w-0">
          <span className="sr-only">搜索曲目</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索曲名 / 曲师 / 画师 / ID"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <div role="tablist" aria-label="选择谱师难度" className="flex gap-1.5 shrink-0">
          {DIFFICULTIES.map((diff) => {
            const active = selectedDiff === diff;
            return (
              <button
                key={diff}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setSelectedDiff(diff)}
                className={cx(
                  'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border',
                  active
                    ? DIFFICULTY_BADGE[diff]
                    : 'text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-neutral-800',
                )}
              >
                {diff}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">没有找到匹配的曲目。</p>
      ) : (
        <>
          {/* 移动端：卡片列表（信息垂直堆叠，可读性优先） */}
          <div className="md:hidden space-y-2.5">
            {filtered.map((song) => {
              const designer = song[DESIGNER_FIELD[selectedDiff]];
              return (
                <div
                  key={song.id}
                  className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3.5 space-y-2"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{song.name}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 break-all">{song.id}</div>
                  </div>
                  <dl className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5">
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-400 dark:text-gray-500 shrink-0">曲师</dt>
                      <dd className="text-right break-words">{song.composer || '-'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-400 dark:text-gray-500 shrink-0">画师</dt>
                      <dd className="text-right break-words">{song.illustrator || '-'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-400 dark:text-gray-500 shrink-0">{selectedDiff} 谱师</dt>
                      <dd className="text-right break-words">{designer || '-'}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>

          {/* 桌面端：表格 */}
          <div className="hidden md:block overflow-x-auto -mx-4 sm:mx-0">
            <table className="text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-neutral-700">
                  <th className="px-3 py-2 font-medium">曲目/曲目ID</th>
                  <th className="px-2 py-2 font-medium">曲师</th>
                  <th className="px-2 py-2 font-medium">画师</th>
                  <th className="px-2 py-2 font-medium text-center whitespace-nowrap">{selectedDiff} 谱师</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((song) => {
                  const designer = song[DESIGNER_FIELD[selectedDiff]];
                  return (
                    <tr
                      key={song.id}
                      className="border-b border-gray-100 dark:border-neutral-800/70 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{song.name}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{song.id}</div>
                      </td>
                      <td className="px-2 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">{song.composer || '-'}</td>
                      <td className="px-2 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {song.illustrator || '-'}
                      </td>
                      <td className="px-2 py-2.5 text-center text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {designer || <span className="text-gray-300 dark:text-gray-600">-</span>}
                      </td>
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
