'use client';

import { useState } from 'react';
import { Music2 } from 'lucide-react';

import type { SongCandidate, SongChartConstants } from '../lib/api/song';
import { DIFFICULTY_BADGE, type Difficulty } from '../lib/constants/difficultyColors';
import { cx } from './ui/styles';

const DIFFICULTY_ORDER: Difficulty[] = ['EZ', 'HD', 'IN', 'AT'];
const DIFFICULTY_LEVEL_KEY: Record<Difficulty, keyof SongChartConstants> = {
  EZ: 'ez',
  HD: 'hd',
  IN: 'in',
  AT: 'at',
};

export interface SongCandidateListProps {
  candidates: SongCandidate[];
  onSelect: (candidate: SongCandidate) => void;
  /** 面板标题，默认「找到 N 首匹配曲目，请选择」 */
  title?: string;
  /** 后端报告的总命中数（可能多于已返回的候选数量） */
  total?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * 曲绘缩略图：优先 CDN 低清 WebP，失败退回 CDN 低清 PNG，再失败退回占位图标
 * （部分曲目 ID 含特殊符号，或新曲尚未在 CDN 生成变体）。
 */
function CandidateCover({ candidate }: { candidate: SongCandidate }) {
  // 依次尝试的地址：0 = 主图（CDN WebP），1 = 兜底（CDN PNG），越界即占位
  const sources = [candidate.coverUrl, candidate.coverFallbackUrl].filter(
    (url, index, list): url is string => Boolean(url) && list.indexOf(url) === index,
  );
  const [attempt, setAttempt] = useState(0);
  const src = sources[attempt];

  if (!src) {
    return (
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-neutral-800 dark:text-gray-500"
        aria-hidden="true"
      >
        <Music2 className="h-5 w-5" />
      </span>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- 说明：曲绘为 CDN 静态资源（somnia.xtower.site，长缓存），不走 next/image 优化链路 */
    <img
      src={src}
      alt=""
      width={48}
      height={48}
      loading="lazy"
      decoding="async"
      onError={() => setAttempt((current) => current + 1)}
      className="h-12 w-12 shrink-0 rounded-lg bg-gray-100 object-cover dark:bg-neutral-800"
    />
  );
}

/** 难度定数徽标（仅展示存在的难度）。 */
function DifficultyBadges({ candidate }: { candidate: SongCandidate }) {
  const constants = candidate.chartConstants;
  if (!constants) return null;

  const levels: Array<{ difficulty: Difficulty; level: number }> = DIFFICULTY_ORDER.map((difficulty) => ({
    difficulty,
    level: constants[DIFFICULTY_LEVEL_KEY[difficulty]],
  })).filter((entry): entry is { difficulty: Difficulty; level: number } => entry.level !== null);

  if (levels.length === 0) return null;

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {levels.map(({ difficulty, level }) => (
        <span
          key={difficulty}
          className={cx(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
            DIFFICULTY_BADGE[difficulty],
          )}
        >
          <span className="opacity-80">{difficulty}</span>
          {level.toFixed(1)}
        </span>
      ))}
    </span>
  );
}

/**
 * 检索候选列表（单曲查询 / 玩家成绩渲染共用）。
 *
 * 展示曲绘、曲名、曲师/画师、各难度定数与曲目 ID：
 * 后端 409 的候选预览只含 id/name，曲师与定数由调用方（`searchSong`）补全后传入。
 */
export function SongCandidateList({
  candidates,
  onSelect,
  title,
  total,
  disabled = false,
  className,
}: SongCandidateListProps) {
  if (candidates.length === 0) return null;

  const heading = title ?? '找到多首匹配曲目，请选择：';
  const hiddenCount = total !== undefined ? Math.max(0, total - candidates.length) : 0;

  return (
    <div
      className={cx(
        'rounded-xl border border-amber-300 bg-amber-50/80 p-3 dark:border-amber-800/60 dark:bg-amber-900/20',
        className,
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{heading}</p>
        <span className="text-xs text-amber-700/80 dark:text-amber-300/70">
          共 {total ?? candidates.length} 首
          {hiddenCount > 0 ? `（仅展示前 ${candidates.length} 首）` : ''}
        </span>
      </div>

      <ul className="space-y-1.5">
        {candidates.map((candidate) => (
          <li key={candidate.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(candidate)}
              className="flex w-full items-center gap-3 rounded-lg border border-amber-200/80 bg-white/80 px-2.5 py-2 text-left transition-colors hover:border-amber-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-800/50 dark:bg-neutral-900/60 dark:hover:border-amber-600 dark:hover:bg-neutral-900"
            >
              <CandidateCover candidate={candidate} />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {candidate.name}
                  </span>
                  <DifficultyBadges candidate={candidate} />
                </span>
                <span className="block truncate text-xs text-gray-600 dark:text-gray-400">
                  {candidate.artist || '曲师未知'}
                  {candidate.illustrator ? ` · 画师 ${candidate.illustrator}` : ''}
                </span>
                <span
                  className="block truncate font-mono text-[11px] text-gray-400 dark:text-gray-500"
                  title={`曲目 ID：${candidate.id}`}
                >
                  {candidate.id}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-amber-700/80 dark:text-amber-300/70">
        点击任意曲目即可直接查询该曲成绩；也可改用更精确的关键词（如「曲名 + 曲师」）。
      </p>
    </div>
  );
}
