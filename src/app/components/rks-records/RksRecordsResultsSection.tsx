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

/**
 * 桌面端数据行高度（px），必须与 CSS 保证的真实行高严格相等：
 * py-3 上下内边距 24 + 歌曲名最多两行 40（text-sm 行高 20）+ 分隔线 1 = 65。
 *
 * 这个值同时用作虚拟化的 estimateSize 与行的内联 height。两者不一致时，虚拟化每测量到一行
 * 就改一次总高度，滚动过程中滚动条与下方内容持续位移（实测 300 行滚动 60 步，内容高度从
 * 16464px 涨到 21377px）。改单元格内边距 / 字号 / 歌曲名行数上限时，必须同步改这里。
 */
export const RKS_TABLE_ROW_HEIGHT = 65;

/**
 * 桌面表格的列宽（px，合计 = 表格 min-width 980）。
 *
 * 必须显式固定列宽（配合 table-fixed）：虚拟化只渲染可视窗口内的行，而自动表格布局的
 * 列宽是由「当前渲染出来的这些行」的内容算出来的——窗口一移动，列宽就跟着变
 * （实测每滚动一步「排名」列在 60~61.9px 之间变化）。列宽一变，歌曲名的折行、
 * 操作列按钮的折行都会跟着变，行高就会在滚动中跳变，整张表的格式看起来在抖。
 * 固定列宽后，列宽只由这里决定，与渲染了哪些行完全无关。
 */
const RKS_TABLE_COLUMN_WIDTHS = [68, 236, 76, 68, 104, 92, 108, 92, 136];

/** 表头单元格：sticky 表头需要自身有背景，边框必须落在单元格上（border-separate 不画 tr 边框）。 */
const RKS_HEAD_CELL =
  'align-middle py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700';

/** 数据单元格：同样把分隔线放在单元格上，保证行高恒为 RKS_TABLE_ROW_HEIGHT。 */
const RKS_BODY_CELL = 'align-middle py-3 px-4 border-b border-gray-100 dark:border-gray-800';

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
  // 行高固定为 RKS_TABLE_ROW_HEIGHT，估算值与真实行高严格相等（见该常量注释）。
  const { scrollRef, virtualItems, totalSize, measureElement, scrollClassName } = useVirtualRows(
    records.length,
    RKS_TABLE_ROW_HEIGHT,
  );
  // 移动端卡片列表虚拟化（卡片高度随视口变化，用首张卡片实测校准估算值）
  const {
    scrollRef: mobileScrollRef,
    virtualItems: mobileVirtualItems,
    totalSize: mobileTotalSize,
    measureElement: mobileMeasureElement,
    scrollClassName: mobileScrollClassName,
  } = useVirtualRows(records.length, 180, { cardList: true });
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
        style={{ maxHeight: VIRTUAL_VIEWPORT_MAX_HEIGHT, position: 'relative' }}
      >
        {/* 撑出完整列表长度：卡片是绝对定位，不显式给出这段高度时，滚动范围只会到
            「已渲染卡片的最低点」，于是滚动过程中不断变长、滚动条也不反映真实列表长度。
            外层只负责 640px 视口与滚动，而 maxHeight 会把自身高度压到 640，
            所以完整长度必须由子元素给出。 */}
        <div style={{ height: mobileTotalSize }} aria-hidden="true" />
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
        {/*
          固定表格布局 + 显式列宽 + 固定行高 + border-separate：
          - table-fixed/colgroup：列宽不再由「当前渲染了哪些行」的内容决定（否则每滚动一步列宽都会变）。
          - border-separate：border-collapse 下相邻行共用的边框会让行高出现 0.5px 的零头，
            行在滚动中会真的位移半个像素（文字发虚/重影），且 Chrome 里 sticky 表头在
            border-collapse 下本身就有重绘残影问题；分帧边框模型没有这些副作用。
          - 行高固定 RKS_TABLE_ROW_HEIGHT，与 estimateSize 严格相等，滚动期间零漂移。
        */}
        <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-0">
          <colgroup>
            {RKS_TABLE_COLUMN_WIDTHS.map((width, index) => (
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-white dark:bg-gray-900">
            <tr>
              <th className={cx(RKS_HEAD_CELL, 'truncate text-left')}>排名</th>
              <th className={cx(RKS_HEAD_CELL, 'text-left')}>歌曲名称</th>
              <th className={cx(RKS_HEAD_CELL, 'truncate text-center')}>难度</th>
              <th className={cx(RKS_HEAD_CELL, 'truncate text-center')}>定数</th>
              <th className={cx(RKS_HEAD_CELL, 'truncate text-center')}>分数</th>
              <th className={cx(RKS_HEAD_CELL, 'truncate text-center')}>准确率</th>
              <th className={cx(RKS_HEAD_CELL, 'truncate text-center')} title={pushAccHeaderTitle}>
                推分ACC
              </th>
              <th className={cx(RKS_HEAD_CELL, 'truncate text-center')}>单曲RKS</th>
              <th className={cx(RKS_HEAD_CELL, 'truncate text-center')}>操作</th>
            </tr>
          </thead>
          <tbody>
            <VirtualSpacerRow height={paddingTop} />
            {virtualRows.map(({ virtualItem, record }) => (
              <tr
                key={`${record.song_name}|${record.difficulty}|${record.difficulty_value}|${record.score}`}
                data-index={virtualItem.index}
                ref={measureElement}
                style={{ height: RKS_TABLE_ROW_HEIGHT }}
                className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
              >
                <td className={cx(RKS_BODY_CELL, 'truncate text-sm text-gray-600 dark:text-gray-400')}>
                  #{virtualItem.index + 1}
                </td>
                <td className={cx(RKS_BODY_CELL, 'text-sm font-medium text-gray-900 dark:text-gray-100')}>
                  {/* 行高固定，歌曲名最多两行；超出部分省略，完整名字放 title */}
                  <div className="line-clamp-2 break-words" title={record.song_name}>
                    {record.song_name}
                  </div>
                </td>
                <td className={cx(RKS_BODY_CELL, 'truncate text-center')}>
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-semibold ${DIFFICULTY_BG[record.difficulty]} ${DIFFICULTY_TEXT[record.difficulty]}`}
                  >
                    {record.difficulty}
                  </span>
                </td>
                <td className={cx(RKS_BODY_CELL, 'truncate text-center text-sm text-gray-700 dark:text-gray-300')}>
                  {formatFixedNumber(record.difficulty_value, 1)}
                </td>
                <td className={cx(RKS_BODY_CELL, 'truncate text-center text-sm text-gray-700 dark:text-gray-300')}>
                  {formatLocaleNumber(record.score, 'zh-CN')}
                </td>
                <td className={cx(RKS_BODY_CELL, 'truncate text-center text-sm text-gray-700 dark:text-gray-300')}>
                  {formatFixedNumber(record.acc, 2)}%
                </td>
                <td className={cx(RKS_BODY_CELL, 'truncate text-center text-sm')}>
                  {(() => {
                    const { text, className, title } = formatPushAcc(record);
                    return (
                      <span className={className} title={title}>
                        {text}
                      </span>
                    );
                  })()}
                </td>
                <td className={cx(RKS_BODY_CELL, 'truncate text-center text-sm font-semibold text-blue-600 dark:text-blue-400')}>
                  {formatFixedNumber(record.rks, 4)}
                </td>
                <td className={cx(RKS_BODY_CELL, 'text-center')}>
                  {/* 操作列宽度已按按钮实际宽度留足；禁止换行，避免行高被按钮折行顶高 */}
                  <div className="inline-flex flex-nowrap items-center justify-center gap-2">
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
