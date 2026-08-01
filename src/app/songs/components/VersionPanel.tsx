'use client';

import { useMemo } from 'react';

import type { Difficulty } from '@/app/lib/constants/difficultyColors';
import { DIFFICULTY_BADGE } from '@/app/lib/constants/difficultyColors';
import type { SongInfoData } from '@/app/lib/info/csv';
import { computeTheoryRks, getSongLevel } from '@/app/lib/info/csv';
import { cardStyles } from '../../components/ui/styles';

const DIFFICULTIES: Difficulty[] = ['EZ', 'HD', 'IN', 'AT'];

function difficultySummary(data: SongInfoData, difficulty: Difficulty) {
  const levels = data.songs
    .map((song) => getSongLevel(song, difficulty))
    .filter((level): level is number => level !== null);
  if (levels.length === 0) return { count: 0, max: null, min: null };
  return {
    count: levels.length,
    max: Math.max(...levels),
    min: Math.min(...levels),
  };
}

export function VersionPanel({ data }: { data: SongInfoData }) {
  const summaries = useMemo(
    () => Object.fromEntries(DIFFICULTIES.map((d) => [d, difficultySummary(data, d)])) as Record<
      Difficulty,
      ReturnType<typeof difficultySummary>
    >,
    [data],
  );

  const highest = useMemo(() => {
    let songId: string | null = null;
    let level = -1;
    let diff: Difficulty | null = null;
    for (const s of data.songs) {
      for (const d of DIFFICULTIES) {
        const v = getSongLevel(s, d);
        if (v !== null && v > level) {
          level = v;
          songId = s.id;
          diff = d;
        }
      }
    }
    if (songId === null || diff === null) return null;
    const song = data.songs.find((s) => s.id === songId);
    return { songId, level, diff, name: song?.name ?? songId };
  }, [data]);

  const theoryRks = useMemo(() => computeTheoryRks(data.songs), [data]);

  return (
    <div className="space-y-4">
      <div className={cardStyles({ className: 'space-y-3 p-4 sm:p-6' })}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">版本信息</h3>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">游戏版本</dt>
            <dd className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{data.version || '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">构建号</dt>
            <dd className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{data.build ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">收录曲目</dt>
            <dd className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{data.songs.length} 首</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">理论 RKS</dt>
            <dd className="mt-1 font-semibold tabular-nums text-gray-900 dark:text-gray-100">
              {theoryRks !== null ? theoryRks.toFixed(2) : '-'}
            </dd>
          </div>
        </dl>
        {highest && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            当前全站最高定数：
            <span className={DIFFICULTY_BADGE[highest.diff]}>{highest.diff} {highest.level.toFixed(1)}</span>{' '}
            · {highest.name}
          </p>
        )}
      </div>

      <div className={cardStyles({ className: 'space-y-4 p-4 sm:p-6' })}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">难度分布</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DIFFICULTIES.map((diff) => {
            const s = summaries[diff];
            return (
              <div
                key={diff}
                className="rounded-xl border border-gray-200 dark:border-neutral-700 p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-md text-sm font-bold ${DIFFICULTY_BADGE[diff]}`}>
                    {diff}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{s.count} 首</span>
                </div>
                <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {s.max != null ? s.max.toFixed(1) : '-'}
                  <span className="text-xs font-normal text-gray-400 ml-1">最高</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <div>最低 {s.min != null ? s.min.toFixed(1) : '-'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
