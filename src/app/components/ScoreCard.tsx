import React from 'react';
import type { CSSProperties } from 'react';
import { RksRecord } from '../lib/types/score';
import { DIFFICULTY_BADGE } from '../lib/constants/difficultyColors';
import { formatFixedNumber, formatLocaleNumber } from '../lib/utils/number';

interface ScoreCardProps {
  record: RksRecord;
  rank?: number;
  nameMaxLines?: number; // 1=单行省略，>1=多行省略
}

export function ScoreCard({ record, rank, nameMaxLines = 1 }: ScoreCardProps) {
  const nameMultiline = nameMaxLines && nameMaxLines > 1;
  const nameStyle: CSSProperties | undefined = nameMultiline
    ? { display: '-webkit-box', WebkitLineClamp: nameMaxLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
    : undefined;

  const pushAccDisplay = (() => {
    if (record.already_phi) return { text: '已满ACC', className: 'text-gray-600 dark:text-gray-300', title: '已满ACC：该谱面准确率已达 100%' };
    if (record.unreachable) return { text: '不可推分', className: 'text-red-600 dark:text-red-400', title: '不可推分：即使 Phi 也达不到推分线' };
    if (record.phi_only) return { text: '需Phi', className: 'text-amber-600 dark:text-amber-400', title: '需Phi：只有 Phi(100%) 才能达到推分线' };
    if (typeof record.push_acc === 'number' && Number.isFinite(record.push_acc)) {
      return { text: `${formatFixedNumber(record.push_acc, 2)}%`, className: 'text-emerald-700 dark:text-emerald-400', title: '推分ACC：达到推分线所需的最低准确率' };
    }
    return { text: '—', className: 'text-gray-500 dark:text-gray-400', title: '已在推分线以上或推分线缺失' };
  })();
  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-4 shadow-lg">
      <div className="flex items-center justify-between gap-3 min-h-12">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {typeof rank === 'number' && (
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap shrink-0">#{rank}</span>
            )}
            <h3
              className={`text-base sm:text-lg font-semibold ${nameMultiline ? '' : 'truncate'} text-gray-900 dark:text-gray-100`}
              title={record.song_name}
              style={nameStyle}
            >
              {record.song_name}
            </h3>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${DIFFICULTY_BADGE[record.difficulty]}`}>
              {record.difficulty}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] tracking-wide text-gray-500 dark:text-gray-400">单曲RKS</div>
          <div className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400">
            {formatFixedNumber(record.rks, 4)}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white/60 dark:bg-gray-900/40 rounded-lg px-2 py-2 text-center border border-gray-200 dark:border-gray-700">
          <div className="text-[10px] text-gray-500 dark:text-gray-400">定数</div>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatFixedNumber(record.difficulty_value, 1)}</div>
        </div>
        <div className="bg-white/60 dark:bg-gray-900/40 rounded-lg px-2 py-2 text-center border border-gray-200 dark:border-gray-700">
          <div className="text-[10px] text-gray-500 dark:text-gray-400">分数</div>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatLocaleNumber(record.score, 'zh-CN')}</div>
        </div>
        <div className="bg-white/60 dark:bg-gray-900/40 rounded-lg px-2 py-2 text-center border border-gray-200 dark:border-gray-700">
          <div className="text-[10px] text-gray-500 dark:text-gray-400">准确率</div>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatFixedNumber(record.acc, 2)}%</div>
        </div>
        <div className="bg-white/60 dark:bg-gray-900/40 rounded-lg px-2 py-2 text-center border border-gray-200 dark:border-gray-700">
          <div className="text-[10px] text-gray-500 dark:text-gray-400">推分ACC</div>
          <div className={`text-sm font-medium ${pushAccDisplay.className}`} title={pushAccDisplay.title}>
            {pushAccDisplay.text}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScoreCard;
