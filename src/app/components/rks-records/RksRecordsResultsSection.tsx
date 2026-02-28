'use client';

import type { RksRecord } from '../../lib/types/score';
import { DIFFICULTY_BG, DIFFICULTY_TEXT } from '../../lib/constants/difficultyColors';
import { formatFixedNumber, formatLocaleNumber } from '../../lib/utils/number';
import { ScoreCard } from '../ScoreCard';
import { RotatingTips } from '../RotatingTips';

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

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        显示 {records.length} 条记录{totalMatched !== records.length ? `（匹配 ${totalMatched} 条）` : ''}
      </div>

      {/* Mobile: Card list */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {records.map((record, index) => (
          <div
            key={`${record.song_name}|${record.difficulty}|${record.difficulty_value}|${record.score}`}
            className="space-y-2"
          >
            <ScoreCard record={record} rank={index + 1} nameMaxLines={2} />
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
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
              >
                单曲查询
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse">
          <thead>
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
            {records.map((record, index) => (
              <tr
                key={`${record.song_name}|${record.difficulty}|${record.difficulty_value}|${record.score}`}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
              >
                <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  #{index + 1}
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
                      className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
                    >
                      查询
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
