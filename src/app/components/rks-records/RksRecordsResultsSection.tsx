'use client';

import type { RksRecord } from '../../lib/types/score';
import { DIFFICULTY_BG, DIFFICULTY_TEXT } from '../../lib/constants/difficultyColors';
import { formatFixedNumber, formatLocaleNumber } from '../../lib/utils/number';
import { ScoreCard } from '../ScoreCard';
import { RotatingTips } from '../RotatingTips';
import { cx } from '../ui/styles';
import {
  getSpacerHeights,
  useVirtualRows,
  virtualItemStyle,
  VirtualSpacerRow,
  VIRTUAL_VIEWPORT_MAX_HEIGHT,
} from '../ui/virtualRows';
import { useIsDesktop } from '../../hooks/useIsDesktop';

type PushAccCell = {
  text: string;
  className: string;
  title: string;
};

interface RksRecordsResultsSectionProps {
  isLoading: boolean;
  records: RksRecord[];
  totalMatched: number;
  allRecordsCount: number;
  pushAccHeaderTitle: string;
  onCopySong: (songName: string) => void;
  onOpenSongQuery: (songName: string) => void;
  formatPushAcc: (record: RksRecord) => PushAccCell;
}

export function RksRecordsResultsSection({
  isLoading,
  records,
  totalMatched,
  allRecordsCount,
  pushAccHeaderTitle,
  onCopySong,
  onOpenSongQuery,
  formatPushAcc,
}: RksRecordsResultsSectionProps) {
  // 桌面端表格虚拟化（RKS 记录可达数百条）。注意 hook 必须在提前 return 之前调用。
  const { scrollRef, virtualItems, totalSize, measureElement, scrollClassName } = useVirtualRows(
    records.length,
    52,
  );
  // 移动端卡片列表虚拟化
  const {
    scrollRef: mobileScrollRef,
    virtualItems: mobileVirtualItems,
    totalSize: mobileTotalSize,
    measureElement: mobileMeasureElement,
    scrollClassName: mobileScrollClassName,
  } = useVirtualRows(records.length, 180);
  const isDesktop = useIsDesktop();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <RotatingTips />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
        {allRecordsCount === 0 ? '暂无成绩记录' : '没有符合条件的记录'}
      </div>
    );
  }

  // 断点未确定（SSR 与 hydration 首帧）时两套都渲染，由 CSS 决定显隐；确定后只渲染一套。
  const desktopRows = isDesktop === false ? [] : virtualItems;
  const mobileRows = isDesktop === true ? [] : mobileVirtualItems;
  const { paddingTop, paddingBottom } = getSpacerHeights(
    desktopRows,
    desktopRows.length ? totalSize : 0,
  );
  const virtualRows = desktopRows.map((virtualItem) => ({
    virtualItem,
    record: records[virtualItem.index],
  }));
  const mobileVirtualRows = mobileRows.map((virtualItem) => ({
    virtualItem,
    record: records[virtualItem.index],
  }));

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        显示 {records.length} 条记录{totalMatched !== records.length ? `（匹配 ${totalMatched} 条）` : ''}
      </div>

      {/* Mobile: Card list（虚拟化，仅渲染可视卡片） */}
      <div
        ref={mobileScrollRef}
        className={cx('md:hidden', mobileScrollClassName)}
        style={{ maxHeight: VIRTUAL_VIEWPORT_MAX_HEIGHT, height: mobileTotalSize, position: 'relative' }}
      >
        {mobileVirtualRows.map(({ virtualItem, record }) => (
          <div
            key={`${record.song_name}|${record.difficulty}|${record.difficulty_value}|${record.score}`}
            data-index={virtualItem.index}
            ref={mobileMeasureElement}
            style={virtualItemStyle(virtualItem.start)}
            className="space-y-2 mb-3"
          >
            <ScoreCard record={record} rank={virtualItem.index + 1} nameMaxLines={2} />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onCopySong(record.song_name)}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                复制歌名
              </button>
              <button
                type="button"
                onClick={() => onOpenSongQuery(record.song_name)}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                单曲查询
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Table（虚拟化，仅渲染可视行） */}
      <div
        ref={scrollRef}
        className={cx('hidden md:block', scrollClassName)}
        style={{ maxHeight: VIRTUAL_VIEWPORT_MAX_HEIGHT }}
      >
        <table className="min-w-[980px] w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-white dark:bg-gray-900">
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                排名
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                歌曲名称
              </th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                难度
              </th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                定数
              </th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                分数
              </th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                准确率
              </th>
              <th
                className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap"
                title={pushAccHeaderTitle}
              >
                推分ACC
              </th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                单曲RKS
              </th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            <VirtualSpacerRow height={paddingTop} />
            {virtualRows.map(({ virtualItem, record }) => (
              <tr
                key={`${record.song_name}|${record.difficulty}|${record.difficulty_value}|${record.score}`}
                data-index={virtualItem.index}
                ref={measureElement}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
              >
                <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  #{virtualItem.index + 1}
                </td>
                <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-normal break-words">
                  {record.song_name}
                </td>
                <td className="py-3 px-4 text-center whitespace-nowrap">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-semibold ${DIFFICULTY_BG[record.difficulty]} ${DIFFICULTY_TEXT[record.difficulty]}`}
                  >
                    {record.difficulty}
                  </span>
                </td>
                <td className="py-3 px-4 text-center text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {formatFixedNumber(record.difficulty_value, 1)}
                </td>
                <td className="py-3 px-4 text-center text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {formatLocaleNumber(record.score, 'zh-CN')}
                </td>
                <td className="py-3 px-4 text-center text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {formatFixedNumber(record.acc, 2)}%
                </td>
                <td className="py-3 px-4 text-center text-sm whitespace-nowrap">
                  {(() => {
                    const { text, className, title } = formatPushAcc(record);
                    return (
                      <span className={className} title={title}>
                        {text}
                      </span>
                    );
                  })()}
                </td>
                <td className="py-3 px-4 text-center text-sm font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                  {formatFixedNumber(record.rks, 4)}
                </td>
                <td className="py-3 px-4 text-center text-sm whitespace-nowrap">
                  <div className="inline-flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => onCopySong(record.song_name)}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50 px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                    >
                      复制
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenSongQuery(record.song_name)}
                      className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      查询
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            <VirtualSpacerRow height={paddingBottom} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
