'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import type { Difficulty } from '@/app/lib/constants/difficultyColors';
import { DIFFICULTY_BADGE } from '@/app/lib/constants/difficultyColors';
import type { SongInfo } from '@/app/lib/info/csv';
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

const DIFFICULTIES: Difficulty[] = ['EZ', 'HD', 'IN', 'AT'];

/**
 * 桌面端数据行高度（px），必须与 CSS 保证的真实行高严格相等：
 * py-2.5 上下内边距 20 + 曲名 20（text-sm 行高）+ 曲目ID 16（text-xs 行高）+ 分隔线 1 = 57。
 *
 * 这个值同时用作虚拟化的 estimateSize 与行的内联 height。此前估算写死 56、真实 57，
 * 虚拟化每测量到一行就把总高度抬高 1px（实测滚动 25 步内容高度 16853→16966px），
 * 加上 border-collapse 让行高在 57/56.5 之间跳、可见行整体位移半个像素。
 * 曲名 / 曲师 / 画师 / 谱师都由 truncate 保证只有一行，改内边距 / 字号时必须同步改这里。
 */
export const SONG_INFO_ROW_HEIGHT = 57;

/** 数据单元格：分隔线必须落在单元格上（border-separate 不画 tr 边框），行高才恒为常量。 */
const SONG_INFO_BODY_CELL = 'border-b border-gray-100 dark:border-neutral-800/70';

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

  // 桌面端表格虚拟化：仅渲染可视行（搜索输入时不再重排数百行 DOM）
  // 行高固定为 SONG_INFO_ROW_HEIGHT，估算值与真实行高严格相等（见该常量注释）。
  const { scrollRef, virtualItems, totalSize, measureElement, scrollClassName } = useVirtualRows(
    filtered.length,
    SONG_INFO_ROW_HEIGHT,
  );

  // 移动端卡片列表虚拟化（卡片高度随视口变化，用首张卡片实测校准估算值）
  const {
    scrollRef: mobileScrollRef,
    virtualItems: mobileVirtualItems,
    totalSize: mobileTotalSize,
    measureElement: mobileMeasureElement,
    scrollClassName: mobileScrollClassName,
  } = useVirtualRows(filtered.length, 190, { cardList: true });

  // 断点未确定（SSR 与 hydration 首帧）时两套都渲染，由 CSS 决定显隐；
  // 确定后只渲染对应的一套，避免重复 DOM 与多余的虚拟化行。
  const isDesktop = useIsDesktop();
  const desktopRows = isDesktop === false ? [] : virtualItems;
  const mobileRows = isDesktop === true ? [] : mobileVirtualItems;
  const { paddingTop, paddingBottom } = getSpacerHeights(
    desktopRows,
    desktopRows.length ? totalSize : 0,
  );

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
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-base sm:text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <RadioGroup.Root
          aria-label="选择谱师难度"
          orientation="horizontal"
          value={selectedDiff}
          onValueChange={(value) => setSelectedDiff(value as Difficulty)}
          className="flex gap-1.5 shrink-0"
        >
          {DIFFICULTIES.map((diff) => {
            const active = selectedDiff === diff;
            return (
              <RadioGroup.Item
                key={diff}
                value={diff}
                className={cx(
                  'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border',
                  active
                    ? DIFFICULTY_BADGE[diff]
                    : 'text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-neutral-800',
                )}
              >
                {diff}
              </RadioGroup.Item>
            );
          })}
        </RadioGroup.Root>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">没有找到匹配的曲目。</p>
      ) : (
        <>
          {/* 移动端：卡片列表（虚拟化，仅渲染可视卡片） */}
          <div
            ref={mobileScrollRef}
            className={cx('md:hidden', mobileScrollClassName)}
            style={{ maxHeight: VIRTUAL_VIEWPORT_MAX_HEIGHT, position: 'relative' }}
          >
            {/* 撑出完整列表长度：卡片是绝对定位，不显式给出这段高度时滚动范围只会到
                「已渲染卡片的最低点」，滚动中不断变长；外层 maxHeight 会把自身高度压到 640。 */}
            <div style={{ height: mobileTotalSize }} aria-hidden="true" />
            {mobileRows.map((virtualItem) => {
              const song = filtered[virtualItem.index];
              const designer = song[DESIGNER_FIELD[selectedDiff]];
              return (
                <div
                  key={song.id}
                  data-index={virtualItem.index}
                  ref={mobileMeasureElement}
                  style={virtualItemStyle(virtualItem.start)}
                  className="mb-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3.5 space-y-2"
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

          {/* 桌面端：表格（虚拟化，仅渲染可视行） */}
          <div
            ref={scrollRef}
            className={cx('hidden md:block', scrollClassName)}
            style={{ maxHeight: VIRTUAL_VIEWPORT_MAX_HEIGHT }}
          >
            {/*
              固定表格布局 + 显式列宽（原本就有）+ 固定行高 + border-separate：
              分隔线画在单元格上，行高恒为 SONG_INFO_ROW_HEIGHT（border-collapse 的共用边框
              会让行高出现 0.5px 零头，行在滚动中会位移半个像素）。
            */}
            <table className="text-sm w-full table-fixed border-separate border-spacing-0">
              <colgroup>
                <col className="w-[32%]" />
                <col className="w-[24%]" />
                <col className="w-[24%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-white dark:bg-neutral-900">
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                  <th className="truncate border-b border-gray-200 px-3 py-2 font-medium dark:border-neutral-700">
                    曲目/曲目ID
                  </th>
                  <th className="truncate border-b border-gray-200 px-2 py-2 font-medium dark:border-neutral-700">
                    曲师
                  </th>
                  <th className="truncate border-b border-gray-200 px-2 py-2 font-medium dark:border-neutral-700">
                    画师
                  </th>
                  <th className="truncate border-b border-gray-200 px-2 py-2 text-center font-medium dark:border-neutral-700">
                    {selectedDiff} 谱师
                  </th>
                </tr>
              </thead>
              <tbody>
                <VirtualSpacerRow height={paddingTop} />
                {desktopRows.map((virtualItem) => {
                  const song = filtered[virtualItem.index];
                  const designer = song[DESIGNER_FIELD[selectedDiff]];
                  return (
                    <tr
                      key={song.id}
                      data-index={virtualItem.index}
                      ref={measureElement}
                      style={{ height: SONG_INFO_ROW_HEIGHT }}
                      className="hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      <td className={cx(SONG_INFO_BODY_CELL, 'px-3 py-2.5')}>
                        <div className="font-medium text-gray-900 dark:text-gray-100 truncate" title={song.name}>
                          {song.name}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 truncate" title={song.id}>
                          {song.id}
                        </div>
                      </td>
                      <td
                        className={cx(SONG_INFO_BODY_CELL, 'px-2 py-2.5 text-gray-600 dark:text-gray-400 truncate')}
                        title={song.composer || undefined}
                      >
                        {song.composer || '-'}
                      </td>
                      <td
                        className={cx(SONG_INFO_BODY_CELL, 'px-2 py-2.5 text-gray-600 dark:text-gray-400 truncate')}
                        title={song.illustrator || undefined}
                      >
                        {song.illustrator || '-'}
                      </td>
                      <td
                        className={cx(SONG_INFO_BODY_CELL, 'px-2 py-2.5 text-center text-gray-600 dark:text-gray-400 truncate')}
                        title={designer || undefined}
                      >
                        {designer || <span className="text-gray-300 dark:text-gray-600">-</span>}
                      </td>
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
