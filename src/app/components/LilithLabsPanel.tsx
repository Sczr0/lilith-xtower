'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Zap } from 'lucide-react';

import { ScoreAPI } from '../lib/api/score';
import { LILITH_SETTINGS_STORAGE_KEY } from '../lib/constants/storageKeys';
import { DIFFICULTY_BG, DIFFICULTY_TEXT } from '../lib/constants/difficultyColors';
import type { RksRecord } from '../lib/types/score';
import { formatFixedNumber } from '../lib/utils/number';
import {
  DEFAULT_LILITH_USER_SETTINGS,
  LILITH_SETTINGS_BOUNDS,
  isLilithUserSettingsDefault,
  parseLilithUserSettings,
  serializeLilithUserSettings,
  type LilithUserSettings,
} from '../lib/utils/lilithSettings';
import {
  DEFAULT_ABSOLUTE_ACC_CEILING,
  DEFAULT_CEILING_PROOF_RAISE,
  DEFAULT_JUMP_BASE,
  buildLilithRecommendations,
  type CandidateTarget,
  type CandidateTargetLabel,
  type LilithRecommendationItem,
  type LilithPool,
  type LilithStructureStatus,
} from '../lib/utils/lilithRecommendation';

const EASY_DELTA_ACC_THRESHOLD = 0.5;
const AP_ACC_THRESHOLD = 100;
const EPS = 1e-6;

/** 安全读取 localStorage（SSR/隐私模式兜底） */
function safeReadStoredSettings(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LILITH_SETTINGS_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** 滑块行（label + 数值 + 说明 + 拖动控件） */
function SettingsSlider({
  label,
  hint,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
        <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
          {formatFixedNumber(value, step < 1 ? 1 : 0)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        className="mt-1.5 w-full accent-blue-600 dark:accent-blue-400"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
      />
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
    </div>
  );
}

type ViewMode = 'efficiency' | 'potential';
type DisplaySuggestion = LilithRecommendationItem;

function buildSingleQueryHref(songName: string): string {
  return `/dashboard?tab=single-query&song=${encodeURIComponent(songName)}`;
}

function formatImbalanceRatio(
  ratio: number,
  hasTop27Roi: boolean,
  hasTop3PhiRoi: boolean,
): string {
  if (!hasTop27Roi && !hasTop3PhiRoi) return '--';
  if (hasTop27Roi && !hasTop3PhiRoi) return '∞';
  if (!hasTop27Roi && hasTop3PhiRoi) return '0.000';
  return formatFixedNumber(ratio, 3);
}

function getTargetLabelText(label: CandidateTargetLabel): string {
  switch (label) {
    case 'stable': return '稳推';
    case 'push_line': return '踩线';
    case 'plus_1': return '+1%';
    case 'plus_2': return '+2%';
    case 'phi': return 'Phi';
    case 'optimal': return '最优';
  }
}

/** 达成概率展示：φ 目标为 P(收掉|定数)，其他目标为 100% */
function formatTargetProbability(probability: number): string {
  if (!Number.isFinite(probability)) return '--';
  return `${formatFixedNumber(probability * 100, 0)}%`;
}

function getTargetLabelClassName(label: CandidateTargetLabel): string {
  switch (label) {
    case 'stable':
      return 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800/60 dark:bg-teal-900/30 dark:text-teal-300';
    case 'push_line':
      return 'border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300';
    case 'plus_1':
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/60 dark:bg-sky-900/30 dark:text-sky-300';
    case 'plus_2':
      return 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800/60 dark:bg-cyan-900/30 dark:text-cyan-300';
    case 'phi':
      return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/60 dark:bg-violet-900/30 dark:text-violet-300';
    case 'optimal':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-300';
  }
}

function getPoolBadge(pool: LilithPool) {
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

/** 可展开的备选目标行 */
function AlternativeTargetRow({ target }: { target: CandidateTarget }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 items-center text-xs text-gray-600 dark:text-gray-400 py-1.5 border-t border-gray-100 dark:border-gray-700/50 first:border-t-0">
      <span
        className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${getTargetLabelClassName(target.label)}`}
        title={target.needsGodRun ? '超出稳定水平，需超常发挥才能达成' : undefined}
      >
        {getTargetLabelText(target.label)}
        {target.needsGodRun ? <Zap className="h-3 w-3" aria-hidden="true" /> : null}
      </span>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-2 gap-y-0.5">
        <span>ACC {formatFixedNumber(target.targetAcc, 2)}%</span>
        <span>ΔACC {formatFixedNumber(target.deltaAcc, 2)}%</span>
        <span>目标RKS {formatFixedNumber(target.targetRks, 4)}</span>
        <span>Δ总RKS {formatFixedNumber(target.deltaTotal, 4)}</span>
        <span>期望ΔRKS {formatFixedNumber(target.expectedDelta, 4)}</span>
        <span>ROI {formatFixedNumber(target.roi, 4)}</span>
        <span className="text-gray-400 dark:text-gray-500">{getPoolBadge(target.pool).label}</span>
        <span className="text-gray-400 dark:text-gray-500">达成 {formatTargetProbability(target.targetProbability)}</span>
      </div>
    </div>
  );
}

/** 推荐卡片组件 */
function RecommendationCard({ item, index }: { item: DisplaySuggestion; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const badge = getPoolBadge(item.pool);
  const record = item.record;
  const alternatives = 'alternativeTargets' in item ? (item as LilithRecommendationItem).alternativeTargets : undefined;
  const hasAlternatives = alternatives && alternatives.length > 0;

  return (
    <article
      key={`${record.song_name}|${record.difficulty}|${record.difficulty_value}|${record.score}`}
      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 p-4"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">建议 #{index + 1}</p>
            {'targetLabel' in item && (item as LilithRecommendationItem).targetLabel && (
              <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${getTargetLabelClassName((item as LilithRecommendationItem).targetLabel)}`}>
                {getTargetLabelText((item as LilithRecommendationItem).targetLabel)}
              </span>
            )}
            {item.needsGodRun && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-300"
                title="目标超出你的稳定水平，需要超常发挥（神经刀）才能达成；勾选「仅看稳定可达」可只看常态能练到的目标"
              >
                <Zap className="h-3 w-3" aria-hidden="true" />
                需超常发挥
              </span>
            )}
          </div>
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
          {item.overReach !== undefined && item.overReach > 0.05 && (
            <div
              className="text-[11px] text-amber-600 dark:text-amber-400"
              title="目标 ACC 超出你的稳定水平（常态可达水平）的百分点"
            >
              超出稳定水平 +{formatFixedNumber(item.overReach, 1)}%
            </div>
          )}
          {item.targetProbability < 1 - EPS && (
            <div
              className="text-[11px] text-violet-600 dark:text-violet-400"
              title="P(收掉|定数)：由你的近-φ 记录按定数拟合的收尾概率。「能打到 99.8%」不等于「能收掉」——手癖、心态与最后一公里的稳定性是另一个维度。"
            >
              收掉把握 {formatTargetProbability(item.targetProbability)}
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
            <span>ΔACC {formatFixedNumber(item.deltaAcc, 2)}%</span>
            <span>目标RKS {formatFixedNumber(item.targetRks, 4)}</span>
            <span>ΔTop27 {formatFixedNumber(item.deltaTop27, 4)}</span>
            <span>ΔTop3Phi {formatFixedNumber(item.deltaTop3Phi, 4)}</span>
            <span>Δ总RKS {formatFixedNumber(item.deltaTotal, 4)}</span>
            <span>期望ΔRKS {formatFixedNumber(item.expectedDelta, 4)}</span>
            <span>ROI {formatFixedNumber(item.roi, 4)}</span>
            <span>达成 {formatTargetProbability(item.targetProbability)}</span>
          </div>
          <div className="flex items-center gap-2">
            {hasAlternatives && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {expanded ? '收起其他目标' : `查看其他目标 (${alternatives!.length})`}
              </button>
            )}
            <Link
              href={buildSingleQueryHref(record.song_name)}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
            >
              去单曲查询
            </Link>
          </div>
        </div>
      </div>
      {expanded && hasAlternatives && (
        <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40 px-3 py-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">其他候选目标</p>
          {alternatives!.map((target, i) => (
            <AlternativeTargetRow key={`${target.label}-${target.targetAcc}-${i}`} target={target} />
          ))}
        </div>
      )}
    </article>
  );
}

export function LilithLabsPanel() {
  const [records, setRecords] = useState<RksRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('efficiency');
  const [poolFilter, setPoolFilter] = useState<'all' | LilithPool>('all');
  const [easyOnly, setEasyOnly] = useState(false);
  const [noApOnly, setNoApOnly] = useState(false);
  const [stableOnly, setStableOnly] = useState(false);
  const [settings, setSettings] = useState<LilithUserSettings>(DEFAULT_LILITH_USER_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    // 首屏触发数据加载（loadRecords 内部会同步设置 loading 态）
    // eslint-disable-next-line react-hooks/set-state-in-effect -- effect 触发一次性数据加载
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    // 恢复用户调参（仅客户端；服务端渲染保持默认值避免 hydration mismatch）
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 一次性恢复持久化配置
    setSettings(parseLilithUserSettings(safeReadStoredSettings()));
  }, []);

  const updateSettings = useCallback((patch: Partial<LilithUserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(LILITH_SETTINGS_STORAGE_KEY, serializeLilithUserSettings(next));
      } catch {
        // localStorage 不可用（隐私模式等）时仅内存生效
      }
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    updateSettings({ ...DEFAULT_LILITH_USER_SETTINGS });
  }, [updateSettings]);

  const isCustomized = useMemo(() => !isLilithUserSettingsDefault(settings), [settings]);

  const buildOptions = useMemo<Parameters<typeof buildLilithRecommendations>[1]>(
    () => ({
      limit: settings.limit,
      potentialOverReachCap: settings.overReachCap,
      stage8: {
        absAccCeiling: settings.absAccCeiling,
        enableProof: settings.enableProof,
        jumpBase: settings.jumpBase,
      },
    }),
    [settings],
  );

  const recommendationResult = useMemo(
    () => buildLilithRecommendations(records, buildOptions),
    [records, buildOptions],
  );
  const structureInfo = useMemo(
    () => getStructureStatusInfo(recommendationResult.status),
    [recommendationResult.status],
  );
  const roiExplanation = useMemo(() => {
    const ratio = recommendationResult.imbalanceRatio;
    const hasTop27Roi = recommendationResult.bestRoiTop27 > EPS;
    const hasTop3PhiRoi = recommendationResult.bestRoiTop3Phi > EPS;

    if (!hasTop27Roi && !hasTop3PhiRoi) {
      return {
        summary: '当前至少有一侧候选不足，暂时无法计算失衡比。',
        detail: '当 Top27 与 Top3Phi 都存在有效候选时，失衡比才有参考意义。',
      };
    }

    if (hasTop27Roi && !hasTop3PhiRoi) {
      return {
        summary: '当前 Top3Phi 暂无有效候选，失衡比按正无穷处理。',
        detail: '这通常意味着当前更适合优先执行 Top27 方向建议，先把主池基础抬高。',
      };
    }

    if (!hasTop27Roi && hasTop3PhiRoi) {
      return {
        summary: '当前 Top27 暂无有效候选，失衡比按 0 处理。',
        detail: '这通常意味着当前更适合补强 Top3Phi，优先处理 AP / Phi 方向的缺口。',
      };
    }

    const ratioPercent = ratio * 100;

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
  }, [recommendationResult.bestRoiTop27, recommendationResult.bestRoiTop3Phi, recommendationResult.imbalanceRatio]);

  // 根据当前视图模式选择基础推荐列表
  const baseRecommendations = viewMode === 'efficiency'
    ? recommendationResult.recommendations
    : recommendationResult.potentialRecommendations;
  const fallbackRecommendations = viewMode === 'efficiency'
    ? recommendationResult.allCandidates
    : recommendationResult.potentialAllCandidates;

  const suggestions = useMemo(() => {
    const matchesFilters = (item: DisplaySuggestion) => {
      if (poolFilter !== 'all' && item.pool !== poolFilter) return false;
      if (easyOnly && item.deltaAcc > EASY_DELTA_ACC_THRESHOLD) return false;
      if (noApOnly && (item.record.phi_only === true || item.targetAcc >= AP_ACC_THRESHOLD)) return false;
      if (stableOnly && item.needsGodRun) return false;
      return true;
    };

    const picked: DisplaySuggestion[] = [];
    const selectedSourceIndex = new Set<number>();
    const push = (item: DisplaySuggestion) => {
      if (picked.length >= settings.limit) return;
      if (selectedSourceIndex.has(item.sourceIndex)) return;
      if (!matchesFilters(item)) return;
      picked.push(item);
      selectedSourceIndex.add(item.sourceIndex);
    };

    for (const item of baseRecommendations) {
      push(item);
      if (picked.length >= settings.limit) break;
    }

    if (picked.length < settings.limit) {
      for (const item of fallbackRecommendations) {
        push(item);
        if (picked.length >= settings.limit) break;
      }
    }

    return picked;
  }, [easyOnly, noApOnly, poolFilter, stableOnly, baseRecommendations, fallbackRecommendations, settings.limit]);

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
                v0.2 Alpha
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
                {formatImbalanceRatio(
                  recommendationResult.imbalanceRatio,
                  recommendationResult.bestRoiTop27 > EPS,
                  recommendationResult.bestRoiTop3Phi > EPS,
                )}
              </p>
            </div>
          </div>
          <div className="mt-2 rounded-md border border-current/20 bg-white/30 dark:bg-black/10 px-3 py-2 text-xs leading-5">
            <p>指标说明：ROI = 期望ΔRKS ÷ 有效推分成本（成本下限为一次完整游玩），bestROI 即该池中的最大值。</p>
            <p className="mt-1">
              期望ΔRKS = 达成概率 × Δ总RKS：φ 目标的达成概率取 P(收掉|定数)（由你的近-φ 记录按定数拟合，
              当前 {recommendationResult.closure.source === 'logistic'
                ? `logistic 拟合，样本 ${recommendationResult.closure.samples} 条 / φ ${recommendationResult.closure.events} 条`
                : `样本不足，回退全局比例 ${formatFixedNumber(recommendationResult.closure.closeRate * 100, 0)}%`}），
              其他目标取 100%。因此「只推 0.001% ACC」这类几乎不动的目标不会被丢弃，而是因期望收益极低自然沉到列表末尾。
            </p>
            <p className="mt-1">有效推分成本会同时考虑高 ACC 区间的非线性难度，以及明显高于玩家当前 Best / AP 水平的高定数降权。</p>
            <p className="mt-1">
              潜力之选：每首曲目取其「目标 ACC 不超过稳定水平 {formatFixedNumber(recommendationResult.potentialOverReachCap, 1)}%」
              且「定数水平惩罚 ≤ {formatFixedNumber(recommendationResult.potentialMaxLevelPenalty, 1)}」内能做到的最大 Δ总RKS 目标；
              超出上限的神经刀 / 未胜任目标会被剔除，避免给出打不过的建议。
            </p>
            <p className="mt-1">
              补充约束（以玩家 RKS {formatFixedNumber(recommendationResult.playerRks, 2)} 为参照）：高定数受绝对 ACC 天花板限制
              （基准 {formatFixedNumber(DEFAULT_ABSOLUTE_ACC_CEILING, 1)}%，能力证明者放宽 {formatFixedNumber(DEFAULT_CEILING_PROOF_RAISE, 1)}%）；
              超过玩家 RKS 0.5 的谱面单次提升受指数递减上限约束（基准 {formatFixedNumber(DEFAULT_JUMP_BASE, 1)}%）。
              潜力视图硬过滤，效率视图折算为成本降权。
            </p>
            <p className="mt-1">{roiExplanation.summary}</p>
            <p className="mt-1 opacity-90">{roiExplanation.detail}</p>
          </div>
        </div>

        {/* 双 Tab 视图切换 */}
        <div className="mt-4 flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-1 w-fit">
          {([
            { value: 'efficiency' as ViewMode, label: '效率之选', desc: '按期望收益效率降序（期望ΔRKS ÷ 成本）' },
            { value: 'potential' as ViewMode, label: '潜力之选', desc: '按可行上限内的最大 Δ总RKS 降序' },
          ]).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setViewMode(tab.value)}
              className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === tab.value
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
              title={tab.desc}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 用户调参（localStorage 持久化，默认收起） */}
        <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            aria-expanded={settingsOpen}
          >
            <span className="font-medium">
              调参
              <span
                className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  isCustomized
                    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {isCustomized ? '已自定义' : '默认参数'}
              </span>
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">{settingsOpen ? '收起' : '展开'}</span>
          </button>
          {settingsOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-3 pb-3">
              <SettingsSlider
                label="高定数 ACC 上限"
                hint="基准水平 +1.0 定数以上的谱面，目标 ACC 最多到多少；调高 → 建议更激进"
                value={settings.absAccCeiling}
                min={LILITH_SETTINGS_BOUNDS.absAccCeiling.min}
                max={LILITH_SETTINGS_BOUNDS.absAccCeiling.max}
                step={LILITH_SETTINGS_BOUNDS.absAccCeiling.step}
                unit="%"
                onChange={(absAccCeiling) => updateSettings({ absAccCeiling })}
              />
              <SettingsSlider
                label="单次提升上限"
                hint="一首歌一次最多建议推多少 ACC；调高 → 允许更大步长的推分推荐"
                value={settings.jumpBase}
                min={LILITH_SETTINGS_BOUNDS.jumpBase.min}
                max={LILITH_SETTINGS_BOUNDS.jumpBase.max}
                step={LILITH_SETTINGS_BOUNDS.jumpBase.step}
                unit="%"
                onChange={(jumpBase) => updateSettings({ jumpBase })}
              />
              <SettingsSlider
                label="上行放宽幅度"
                hint="目标 ACC 最多可超出你的稳定水平多少；调高 → 允许更多超常发挥目标"
                value={settings.overReachCap}
                min={LILITH_SETTINGS_BOUNDS.overReachCap.min}
                max={LILITH_SETTINGS_BOUNDS.overReachCap.max}
                step={LILITH_SETTINGS_BOUNDS.overReachCap.step}
                unit="%"
                onChange={(overReachCap) => updateSettings({ overReachCap })}
              />
              <SettingsSlider
                label="推荐条数"
                hint="每次展示多少条建议"
                value={settings.limit}
                min={LILITH_SETTINGS_BOUNDS.limit.min}
                max={LILITH_SETTINGS_BOUNDS.limit.max}
                step={LILITH_SETTINGS_BOUNDS.limit.step}
                unit=" 条"
                onChange={(limit) => updateSettings({ limit })}
              />
              <label
                className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 sm:col-span-2"
                title="已有两首以上高定数近-φ 成绩（谱面 RKS 达标）时，允许天花板略微 +0.5%"
              >
                <input
                  type="checkbox"
                  checked={settings.enableProof}
                  onChange={(event) => updateSettings({ enableProof: event.target.checked })}
                  className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500"
                />
                允许能力证明放宽（近-φ 成绩记录可略微抬高上限）
              </label>
              <div className="sm:col-span-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={resetSettings}
                  disabled={!isCustomized}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  恢复默认
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
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
          <label
            className="inline-flex items-center gap-2 ml-1 text-xs text-gray-700 dark:text-gray-300"
            title="只显示稳定可达的目标（不需要超常发挥/神经刀）"
          >
            <input
              type="checkbox"
              checked={stableOnly}
              onChange={(event) => setStableOnly(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-700 text-teal-600 focus:ring-teal-500"
            />
            仅看稳定可达
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
            {viewMode === 'potential' && recommendationResult.potentialAllCandidates.length === 0 && recommendationResult.allCandidates.length > 0
              ? '潜力视角下所有可推曲目的目标都超出稳定水平上限，暂无可控上限建议；可切回「效率之选」查看更现实的建议。'
              : recommendationResult.allCandidates.length > 0
                ? '当前筛选条件下暂无建议，尝试放宽筛选。'
                : '暂无可推进曲目。你可能已经接近当前推分线，或当前数据不足以计算。'}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
              <p>
                可推进谱面 <span className="font-semibold text-gray-900 dark:text-gray-100">{viewMode === 'efficiency' ? recommendationResult.allCandidates.length : recommendationResult.potentialAllCandidates.length}</span>{' '}
                条；动态配额 <span className="font-semibold text-gray-900 dark:text-gray-100">{recommendationResult.quota.total}</span>{' '}
                条（Top27: {recommendationResult.quota.top27}，Top3Phi: {recommendationResult.quota.top3phi}）。
              </p>
              <p className="mt-1">
                当前视图：<span className="font-semibold text-gray-900 dark:text-gray-100">{viewMode === 'efficiency' ? '效率之选（ROI 优先）' : '潜力之选（上限增量优先）'}</span>
                ，筛选后展示 <span className="font-semibold text-gray-900 dark:text-gray-100">{suggestions.length}</span> 条。
              </p>
            </div>
            {suggestions.map((item, index) => (
              <RecommendationCard
                key={`${item.record.song_name}|${item.record.difficulty}|${item.record.difficulty_value}|${item.record.score}`}
                item={item}
                index={index}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
