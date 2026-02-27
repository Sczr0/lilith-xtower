'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ScoreAPI } from '../lib/api/score';
import { DIFFICULTY_BG, DIFFICULTY_TEXT } from '../lib/constants/difficultyColors';
import type { RksRecord } from '../lib/types/score';
import { formatFixedNumber } from '../lib/utils/number';
import {
  DEFAULT_LILITH_RECOMMENDATION_LIMIT,
  buildLilithRecommendations,
  type LilithRecommendationItem,
  type LilithPool,
  type LilithStructureStatus,
} from '../lib/utils/lilithRecommendation';

const EASY_DELTA_ACC_THRESHOLD = 0.5;
const RECOMMENDATION_LIMIT = DEFAULT_LILITH_RECOMMENDATION_LIMIT;
const AP_ACC_THRESHOLD = 100;
const EPS = 1e-6;

type DisplayPool = LilithPool | 'archive';

type DisplaySuggestion = Omit<LilithRecommendationItem, 'pool'> & {
  pool: DisplayPool;
  fromArchiveFallback: boolean;
};

function buildSingleQueryHref(songName: string): string {
  return `/dashboard?tab=single-query&song=${encodeURIComponent(songName)}`;
}

function normalizeFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function clampTargetAcc(value: number): number {
  if (!Number.isFinite(value)) return NaN;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function computeRksByAcc(acc: number, constant: number): number {
  if (!Number.isFinite(acc) || !Number.isFinite(constant) || constant <= 0) return 0;
  if (acc < 70) return 0;

  return constant * Math.pow((acc - 55) / 45, 2);
}

function getPoolBadge(pool: DisplayPool) {
  if (pool === 'archive') {
    return {
      label: '存档补全',
      className:
        'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
      reason: '基于存档补全建议位次，不保证直接抬升总 RKS。',
    };
  }

  if (pool === 'dual') {
    return {
      label: '双池',
      className:
        'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-900/30 dark:text-indigo-300',
      reason: '同时改善 Top27 与 Top3Phi，适合优先执行。',
    };
  }

  if (pool === 'top27') {
    return {
      label: 'Top27',
      className:
        'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/60 dark:bg-blue-900/30 dark:text-blue-300',
      reason: '主要提升 Top27 主池，适合先拉高基础 rks。',
    };
  }

  return {
    label: 'Top3Phi',
    className:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-300',
    reason: '主要补强 Top3Phi，适合修正 Phi 池偏低。',
  };
}

function getStructureStatusInfo(status: LilithStructureStatus) {
  if (status === 'top27_low') {
    return {
      title: '结构提示：Top27 潜力未释放',
      description: '当前更适合优先做 Top27 向建议，先把主池抬高。',
      className:
        'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200',
    };
  }

  if (status === 'top3phi_low') {
    return {
      title: '结构提示：Top3Phi 潜力未释放',
      description: '当前更适合补强 Phi 池，避免 Top27 高而 Top3Phi 低导致 rks 虚低。',
      className:
        'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200',
    };
  }

  if (status === 'balanced') {
    return {
      title: '结构提示：Top27 / Top3Phi 基本平衡',
      description: '建议按 ROI 从高到低执行，保持两池同步增长。',
      className:
        'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200',
    };
  }

  return {
    title: '结构提示：候选不足',
    description: '当前无有效推分候选，建议刷新成绩后重试。',
    className:
      'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-200',
  };
}

function buildArchiveFallbackSuggestions(
  records: RksRecord[],
  selectedSourceIndex: Set<number>,
): DisplaySuggestion[] {
  const list: DisplaySuggestion[] = [];

  records.forEach((record, index) => {
    if (selectedSourceIndex.has(index)) return;
    if (record.unreachable === true || record.already_phi === true) return;

    const rawTargetAcc = normalizeFiniteNumber(record.push_acc);
    if (rawTargetAcc === null) return;

    const targetAcc = clampTargetAcc(rawTargetAcc);
    if (!Number.isFinite(targetAcc) || targetAcc < 70) return;

    const deltaAcc = targetAcc - record.acc;
    if (!Number.isFinite(deltaAcc) || deltaAcc <= EPS) return;

    const targetRks = computeRksByAcc(targetAcc, record.difficulty_value);
    if (!Number.isFinite(targetRks) || targetRks <= record.rks + EPS) return;

    const deltaSingle = targetRks - record.rks;
    const deltaTotal = deltaSingle / 30;
    const roi = deltaTotal / Math.max(0.01, deltaAcc);

    list.push({
      record,
      sourceIndex: index,
      targetAcc,
      targetRks,
      deltaAcc,
      deltaTop27: 0,
      deltaTop3Phi: 0,
      deltaTotal,
      roi,
      pool: 'archive',
      fromArchiveFallback: true,
    });
  });

  return list.sort((a, b) => {
    if (a.deltaAcc !== b.deltaAcc) return a.deltaAcc - b.deltaAcc;
    if (a.targetRks !== b.targetRks) return b.targetRks - a.targetRks;
    return a.record.song_name.localeCompare(b.record.song_name, 'zh-CN');
  });
}

export function LilithLabsPanel() {
  const [records, setRecords] = useState<RksRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [poolFilter, setPoolFilter] = useState<'all' | LilithPool>('all');
  const [easyOnly, setEasyOnly] = useState(false);
  const [noApOnly, setNoApOnly] = useState(false);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await ScoreAPI.getRksList();
      setRecords(response.data.records ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载实验室数据失败';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const recommendationResult = useMemo(
    () => buildLilithRecommendations(records, { limit: RECOMMENDATION_LIMIT }),
    [records],
  );
  const structureInfo = useMemo(
    () => getStructureStatusInfo(recommendationResult.status),
    [recommendationResult.status],
  );
  const roiExplanation = useMemo(() => {
    const ratio = recommendationResult.imbalanceRatio;
    const ratioPercent = ratio === null ? null : ratio * 100;

    if (ratio === null) {
      return {
        summary: '当前至少有一侧候选不足，暂时无法计算失衡比。',
        detail: '当 Top27 与 Top3Phi 都存在有效候选时，失衡比才有参考意义。',
      };
    }

    if (ratio < 1) {
      return {
        summary: `失衡比 ${formatFixedNumber(ratio, 3)}（约 ${formatFixedNumber(ratioPercent, 1)}%）表示 Top27 的最优效率低于 Top3Phi。`,
        detail: '更适合优先执行 Top3Phi 方向建议，避免出现 Top27 高、Top3Phi 低导致的 rks 虚低。',
      };
    }

    if (ratio > 1) {
      return {
        summary: `失衡比 ${formatFixedNumber(ratio, 3)}（约 ${formatFixedNumber(ratioPercent, 1)}%）表示 Top27 的最优效率高于 Top3Phi。`,
        detail: '更适合优先执行 Top27 方向建议，先提升主池基础。',
      };
    }

    return {
      summary: `失衡比 ${formatFixedNumber(ratio, 3)}，两侧最优效率基本一致。`,
      detail: '可按 ROI 从高到低执行，维持两池平衡增长。',
    };
  }, [recommendationResult.imbalanceRatio]);

  const suggestions = useMemo(() => {
    const matchesFilters = (item: { pool: DisplayPool; deltaAcc: number; targetAcc: number; record: RksRecord }) => {
      if (poolFilter !== 'all' && item.pool !== poolFilter) return false;
      if (easyOnly && item.deltaAcc > EASY_DELTA_ACC_THRESHOLD) return false;
      if (noApOnly && (item.record.phi_only === true || item.targetAcc >= AP_ACC_THRESHOLD)) return false;
      return true;
    };

    const picked: DisplaySuggestion[] = [];
    const selectedSourceIndex = new Set<number>();
    const push = (item: DisplaySuggestion) => {
      if (picked.length >= RECOMMENDATION_LIMIT) return;
      if (selectedSourceIndex.has(item.sourceIndex)) return;
      if (!matchesFilters(item)) return;
      picked.push(item);
      selectedSourceIndex.add(item.sourceIndex);
    };

    for (const item of recommendationResult.recommendations) {
      push({ ...item, fromArchiveFallback: false });
      if (picked.length >= RECOMMENDATION_LIMIT) break;
    }

    if (picked.length < RECOMMENDATION_LIMIT) {
      for (const item of recommendationResult.allCandidates) {
        push({ ...item, fromArchiveFallback: false });
        if (picked.length >= RECOMMENDATION_LIMIT) break;
      }
    }

    if (picked.length < RECOMMENDATION_LIMIT && poolFilter === 'all') {
      const archiveFallback = buildArchiveFallbackSuggestions(records, selectedSourceIndex);
      for (const item of archiveFallback) {
        push(item);
        if (picked.length >= RECOMMENDATION_LIMIT) break;
      }
    }

    return picked;
  }, [easyOnly, noApOnly, poolFilter, recommendationResult.allCandidates, recommendationResult.recommendations, records]);

  const archiveFallbackCount = useMemo(
    () => suggestions.filter((item) => item.fromArchiveFallback).length,
    [suggestions],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/70 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">实验室-Lilith</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">试验各种奇奇怪怪想法的地方！</p>
            <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50/80 dark:border-yellow-900/50 dark:bg-yellow-950/20 px-3 py-2 text-xs leading-5 text-yellow-900 dark:text-yellow-200">
              <p className="font-semibold">注：根据本服务的用户协议 6.1：</p>
              <p className="mt-1">
                本服务提供的成绩分析、推分计算等功能仅供数据展示与娱乐用途，不构成任何专业建议，您不应依赖其作出任何决策。
              </p>
            </div>
          </div>
          <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800/70 dark:bg-blue-900/30 dark:text-blue-300">
            Alpha 试运行
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">RKS 提升助手</h3>
              <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700 dark:border-orange-800/60 dark:bg-orange-900/30 dark:text-orange-300">
                v0.1 Alpha
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              尝试从算法角度提供一个可能有一点点用的推分目标方向！该功能尚在实验阶段，可能存在不合理建议或 Bug，欢迎戳右上角反馈想法 awa
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadRecords()}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              刷新建议
            </button>
            <Link
              href="/contribute"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
            >
              反馈想法
            </Link>
          </div>
        </div>

        <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${structureInfo.className}`}>
          <p className="font-semibold">{structureInfo.title}</p>
          <p className="mt-1">{structureInfo.description}</p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="rounded-md border border-current/20 bg-white/30 dark:bg-black/10 px-2.5 py-2">
              <p className="opacity-80">bestROI(Top27)</p>
              <p className="mt-0.5 text-sm font-semibold">{formatFixedNumber(recommendationResult.bestRoiTop27, 4)}</p>
            </div>
            <div className="rounded-md border border-current/20 bg-white/30 dark:bg-black/10 px-2.5 py-2">
              <p className="opacity-80">bestROI(Top3Phi)</p>
              <p className="mt-0.5 text-sm font-semibold">{formatFixedNumber(recommendationResult.bestRoiTop3Phi, 4)}</p>
            </div>
            <div className="rounded-md border border-current/20 bg-white/30 dark:bg-black/10 px-2.5 py-2">
              <p className="opacity-80">失衡比</p>
              <p className="mt-0.5 text-sm font-semibold">
                {recommendationResult.imbalanceRatio !== null
                  ? formatFixedNumber(recommendationResult.imbalanceRatio, 3)
                  : '--'}
              </p>
            </div>
          </div>
          <div className="mt-2 rounded-md border border-current/20 bg-white/30 dark:bg-black/10 px-3 py-2 text-xs leading-5">
            <p>指标说明：bestROI = 在该池中“每提升 1% ACC 可换来的最大 Δ总RKS”。</p>
            <p className="mt-1">{roiExplanation.summary}</p>
            <p className="mt-1 opacity-90">{roiExplanation.detail}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {([
            { value: 'all', label: '全部' },
            { value: 'top27', label: '仅 Top27' },
            { value: 'top3phi', label: '仅 Top3Phi' },
            { value: 'dual', label: '仅双池' },
          ] as const).map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setPoolFilter(item.value)}
              className={`inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                poolFilter === item.value
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {item.label}
            </button>
          ))}
          <label className="inline-flex items-center gap-2 ml-1 text-xs text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={easyOnly}
              onChange={(event) => setEasyOnly(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500"
            />
            仅看易推（ΔACC ≤ {EASY_DELTA_ACC_THRESHOLD}%）
          </label>
          <label className="inline-flex items-center gap-2 ml-1 text-xs text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={noApOnly}
              onChange={(event) => setNoApOnly(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500"
            />
            仅看无需AP
          </label>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            正在计算实验建议...
          </div>
        ) : suggestions.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {recommendationResult.allCandidates.length > 0
              ? '当前筛选条件下暂无建议，尝试放宽筛选。'
              : '暂无可推进曲目。你可能已经接近当前推分线，或当前数据不足以计算。'}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
              <p>
                可推进谱面 <span className="font-semibold text-gray-900 dark:text-gray-100">{recommendationResult.allCandidates.length}</span>{' '}
                条；动态配额 <span className="font-semibold text-gray-900 dark:text-gray-100">{recommendationResult.quota.total}</span>{' '}
                条（Top27: {recommendationResult.quota.top27}，Top3Phi: {recommendationResult.quota.top3phi}）。
              </p>
              <p className="mt-1">
                当前筛选后展示 <span className="font-semibold text-gray-900 dark:text-gray-100">{suggestions.length}</span> 条
                {archiveFallbackCount > 0 ? `，其中存档补全 ${archiveFallbackCount} 条。` : '。'}
              </p>
            </div>
            {suggestions.map((item, index) => {
              const badge = getPoolBadge(item.pool);
              const record = item.record;
              return (
              <article
                key={`${record.song_name}|${record.difficulty}|${record.difficulty_value}|${record.score}`}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-500 dark:text-gray-400">建议 #{index + 1}</p>
                    <h4 className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100 break-words">{record.song_name}</h4>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <span
                        className={`inline-flex items-center rounded px-2 py-1 font-semibold ${DIFFICULTY_BG[record.difficulty]} ${DIFFICULTY_TEXT[record.difficulty]}`}
                      >
                        {record.difficulty}
                      </span>
                      <span>定数 {formatFixedNumber(record.difficulty_value, 1)}</span>
                      <span>当前 ACC {formatFixedNumber(record.acc, 2)}%</span>
                      <span>单曲 RKS {formatFixedNumber(record.rks, 4)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">{badge.reason}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-start md:items-end gap-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">目标 ACC</div>
                    <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{formatFixedNumber(item.targetAcc, 2)}%</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                      <span>ΔACC {formatFixedNumber(item.deltaAcc, 2)}%</span>
                      <span>目标RKS {formatFixedNumber(item.targetRks, 4)}</span>
                      <span>ΔTop27 {formatFixedNumber(item.deltaTop27, 4)}</span>
                      <span>ΔTop3Phi {formatFixedNumber(item.deltaTop3Phi, 4)}</span>
                      <span>Δ总RKS {formatFixedNumber(item.deltaTotal, 4)}</span>
                      <span>ROI {formatFixedNumber(item.roi, 4)}</span>
                    </div>
                    <Link
                      href={buildSingleQueryHref(record.song_name)}
                      className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
                    >
                      去单曲查询
                    </Link>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
