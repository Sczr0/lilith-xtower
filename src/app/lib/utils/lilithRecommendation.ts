import type { RksRecord } from '../types/score';

export const DEFAULT_LILITH_RECOMMENDATION_LIMIT = 8;
export const DEFAULT_LILITH_IMBALANCE_THRESHOLD = 1.8;

const TOP27_COUNT = 27;
const TOP3_PHI_COUNT = 3;
const TOTAL_RKS_COUNT = 30;
const EPS = 1e-6;
// 阶段3: 安全边距从 0.35 调为 0.5，让推荐更保守
const PLAYER_LEVEL_SAFE_MARGIN = 0.5;
const PLAYER_LEVEL_LINEAR_FACTOR = 0.45;
const PLAYER_LEVEL_QUADRATIC_FACTOR = 0.8;
const MISSING_AP_PENALTY_FACTOR = 1.15;
const HIGH_ACC_KNEE = 97;
const FINAL_STRETCH_KNEE = 99.5;
const HIGH_ACC_LINEAR_GROWTH = 0.65;
const FINAL_STRETCH_EXP_GROWTH = 2.4;
const PROFILE_LEVEL_SAMPLE_COUNT = 3;
const NEAR_AP_ACC_THRESHOLD = 99.5;
const CLOSE_READY_ACC_THRESHOLD = 99.8;
const HIGH_ACC_PROFILE_THRESHOLD = 98;
const AP_CLOSURE_FALLBACK_GAP = 0.6;
const AP_CLOSURE_SAFE_MARGIN = 0.15;
const AP_CLOSURE_GAP_FACTOR = 0.55;
const AP_CLOSURE_AP_LEVEL_FACTOR = 0.75;
const AP_CLOSURE_NEAR_AP_FACTOR = 0.35;
const AP_CLOSURE_CLOSE_RATE_FACTOR = 1.1;
// 阶段2: 多目标采样参数
const MULTI_TARGET_SAMPLE_COUNT = 6;
// 阶段4: 失衡检测最低收益门槛
const MIN_MEANINGFUL_DELTA = 0.001;
// 阶段2: 高定数锚点取样数量
const HIGH_CONST_SAMPLE_COUNT = 5;

export type LilithPool = 'top27' | 'top3phi' | 'dual';
export type LilithStructureStatus = 'top27_low' | 'top3phi_low' | 'balanced' | 'insufficient';
export type CandidateTargetLabel = 'push_line' | 'plus_1' | 'plus_2' | 'phi' | 'optimal';

export interface CandidateTarget {
  targetAcc: number;
  targetRks: number;
  deltaAcc: number;
  deltaTop27: number;
  deltaTop3Phi: number;
  deltaTotal: number;
  roi: number;
  pool: LilithPool;
  label: CandidateTargetLabel;
}

export interface LilithRecommendationItem {
  record: RksRecord;
  sourceIndex: number;
  targetAcc: number;
  targetRks: number;
  deltaAcc: number;
  deltaTop27: number;
  deltaTop3Phi: number;
  deltaTotal: number;
  roi: number;
  pool: LilithPool;
  targetLabel: CandidateTargetLabel;
  /** 该记录的所有候选目标（用于 UI 展开） */
  alternativeTargets?: CandidateTarget[];
}

export interface LilithRecommendationQuota {
  total: number;
  top27: number;
  top3phi: number;
}

export interface LilithRecommendationResult {
  recommendations: LilithRecommendationItem[];
  allCandidates: LilithRecommendationItem[];
  /** 按 deltaTotal 排序的全量候选（用于潜力视图补位） */
  potentialAllCandidates: LilithRecommendationItem[];
  /** 按 deltaTotal 排序的推荐（潜力最大视图） */
  potentialRecommendations: LilithRecommendationItem[];
  status: LilithStructureStatus;
  quota: LilithRecommendationQuota;
  bestRoiTop27: number;
  bestRoiTop3Phi: number;
  imbalanceRatio: number;
}

type BuildOptions = {
  limit?: number;
  imbalanceThreshold?: number;
};

type LilithPlayerProfile = {
  bestPeakConstant: number;
  apPeakConstant: number | null;
  nearApLevel: number | null;
  apLevel: number | null;
  closeRate: number;
  // 阶段3: 双锚点
  highAccAnchor: number;
  highConstAnchor: number;
};

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

  const factor = Math.pow((acc - 55) / 45, 2);
  return constant * factor;
}

function isPhiRecord(record: RksRecord): boolean {
  return record.already_phi === true || record.acc >= 100 - EPS;
}

function classifyPool(deltaTop27: number, deltaTop3Phi: number): LilithPool | null {
  const top27Positive = deltaTop27 > EPS;
  const top3Positive = deltaTop3Phi > EPS;
  if (top27Positive && top3Positive) return 'dual';
  if (top27Positive) return 'top27';
  if (top3Positive) return 'top3phi';
  return null;
}

// 基于当前成绩抽取"最高 Best / 最高 AP"两个水平锚点，用于高定数降权。
function averageTopDifficultyValues(records: RksRecord[], count: number): number | null {
  const safeCount = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : PROFILE_LEVEL_SAMPLE_COUNT;
  const values = records
    .map((record) => normalizeFiniteNumber(record.difficulty_value) ?? 0)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b - a)
    .slice(0, safeCount);

  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// 阶段3: 加权中位数，用于 highAccAnchor 计算
function weightedMedianDifficultyValue(records: RksRecord[]): number {
  if (records.length === 0) return 0;
  const items = records
    .map((r) => ({ dv: normalizeFiniteNumber(r.difficulty_value) ?? 0, acc: r.acc }))
    .filter((item) => item.dv > 0)
    .sort((a, b) => a.dv - b.dv);
  if (items.length === 0) return 0;

  const totalWeight = items.reduce((sum, item) => sum + item.acc, 0);
  if (totalWeight <= 0) return items[Math.floor(items.length / 2)].dv;

  let accumulated = 0;
  for (const item of items) {
    accumulated += item.acc;
    if (accumulated >= totalWeight / 2) return item.dv;
  }
  return items[items.length - 1].dv;
}

function buildPlayerProfile(records: RksRecord[]): LilithPlayerProfile {
  const bestPeak = records.reduce<RksRecord | null>((currentBest, record) => {
    if (!currentBest) return record;
    if (record.rks !== currentBest.rks) return record.rks > currentBest.rks ? record : currentBest;
    if (record.difficulty_value !== currentBest.difficulty_value) {
      return record.difficulty_value > currentBest.difficulty_value ? record : currentBest;
    }
    return currentBest;
  }, null);

  const apPeak = records.filter(isPhiRecord).reduce<RksRecord | null>((currentBest, record) => {
    if (!currentBest) return record;
    if (record.rks !== currentBest.rks) return record.rks > currentBest.rks ? record : currentBest;
    if (record.difficulty_value !== currentBest.difficulty_value) {
      return record.difficulty_value > currentBest.difficulty_value ? record : currentBest;
    }
    return currentBest;
  }, null);

  const nearApRecords = records.filter((record) => record.acc >= NEAR_AP_ACC_THRESHOLD - EPS && record.acc < 100 - EPS);
  const closeReadyRecords = records.filter((record) => record.acc >= CLOSE_READY_ACC_THRESHOLD - EPS);
  const phiRecords = records.filter(isPhiRecord);

  // 阶段3: closeRate 改用数量比
  const phiRecordsInCloseReady = closeReadyRecords.filter(isPhiRecord);
  const closeRate =
    closeReadyRecords.length > 0
      ? Math.min(1, phiRecordsInCloseReady.length / closeReadyRecords.length)
      : phiRecords.length > 0
        ? 1
        : 0;

  // 阶段3: 双锚点
  const highAccRecords = records.filter((r) => r.acc >= HIGH_ACC_PROFILE_THRESHOLD - EPS);
  const highAccAnchor = weightedMedianDifficultyValue(highAccRecords) || (bestPeak?.difficulty_value ?? 0);

  const highConstAnchor = averageTopDifficultyValues(records, HIGH_CONST_SAMPLE_COUNT) ?? (bestPeak?.difficulty_value ?? 0);

  return {
    bestPeakConstant: bestPeak?.difficulty_value ?? 0,
    apPeakConstant: apPeak?.difficulty_value ?? null,
    nearApLevel: averageTopDifficultyValues(nearApRecords, PROFILE_LEVEL_SAMPLE_COUNT),
    apLevel: averageTopDifficultyValues(phiRecords, PROFILE_LEVEL_SAMPLE_COUNT),
    closeRate,
    highAccAnchor,
    highConstAnchor,
  };
}

function computeDifficultyGapPenalty(targetConstant: number, anchorConstant: number): number {
  if (!Number.isFinite(targetConstant) || targetConstant <= 0) return 1;
  if (!Number.isFinite(anchorConstant) || anchorConstant <= 0) return 1;

  const gap = targetConstant - anchorConstant;
  if (gap <= PLAYER_LEVEL_SAFE_MARGIN) return 1;

  const overflow = gap - PLAYER_LEVEL_SAFE_MARGIN;
  return 1 + overflow * PLAYER_LEVEL_LINEAR_FACTOR + overflow * overflow * PLAYER_LEVEL_QUADRATIC_FACTOR;
}

function computePlayerLevelPenalty(
  targetConstant: number,
  targetAcc: number,
  pool: LilithPool,
  profile: LilithPlayerProfile,
): number {
  // 阶段3: 根据方向选择不同锚点
  // Top27 向建议（需要高 ACC）：用 highAccAnchor
  // Top3Phi 向建议（需要 Phi）：用 highConstAnchor + AP 收尾惩罚
  const isPhiTarget = targetAcc >= 100 - EPS;
  const isTop3PhiDirection = pool === 'top3phi' || pool === 'dual';

  // 基础惩罚：根据方向选择合适的锚点
  let anchor: number;
  if (isPhiTarget || isTop3PhiDirection) {
    anchor = profile.highConstAnchor;
  } else {
    anchor = profile.highAccAnchor;
  }
  // 保底仍使用 bestPeakConstant
  const bestPenalty = computeDifficultyGapPenalty(targetConstant, Math.max(anchor, profile.bestPeakConstant));

  const shouldCheckApLevel = pool !== 'top27' || isPhiTarget;
  if (!shouldCheckApLevel) return bestPenalty;

  if (isPhiTarget) {
    const closurePenalty = computeApClosurePenalty(targetConstant, profile);
    return bestPenalty * closurePenalty;
  }

  const apAnchor = profile.apPeakConstant ?? profile.bestPeakConstant;
  const apPenaltyBase = computeDifficultyGapPenalty(targetConstant, apAnchor);
  const apPenalty = profile.apPeakConstant === null ? apPenaltyBase * MISSING_AP_PENALTY_FACTOR : apPenaltyBase;
  return Math.max(bestPenalty, apPenalty);
}

// 单独建模"能打到 99.8 附近"与"真的能收掉到 100"之间的差距，只作用于目标为 Phi 的建议。
function computeApClosurePenalty(targetConstant: number, profile: LilithPlayerProfile): number {
  const nearApLevel = profile.nearApLevel ?? profile.bestPeakConstant;
  const apLevel = profile.apLevel ?? Math.max(0, nearApLevel - AP_CLOSURE_FALLBACK_GAP);
  const closureGap = Math.max(0, nearApLevel - apLevel);
  const apOverLevel = Math.max(0, targetConstant - apLevel - AP_CLOSURE_SAFE_MARGIN);
  const nearApOverLevel = Math.max(0, targetConstant - nearApLevel - AP_CLOSURE_SAFE_MARGIN);
  const closeRatePenalty = Math.max(0, 1 - profile.closeRate);

  return 1
    + closureGap * AP_CLOSURE_GAP_FACTOR
    + apOverLevel * AP_CLOSURE_AP_LEVEL_FACTOR
    + nearApOverLevel * AP_CLOSURE_NEAR_AP_FACTOR
    + closeRatePenalty * AP_CLOSURE_CLOSE_RATE_FACTOR;
}

// 98% 以上先线性抬升成本，99.5% 之后再切到指数增长，拉开 99.0->99.5 与 99.5->100 的差距。
function computeAccDifficultyMultiplier(currentAcc: number, targetAcc: number): number {
  if (!Number.isFinite(currentAcc) || !Number.isFinite(targetAcc) || targetAcc <= currentAcc + EPS) return 1;

  const midpoint = (currentAcc + targetAcc) / 2;
  if (midpoint <= HIGH_ACC_KNEE) return 1;

  if (midpoint <= FINAL_STRETCH_KNEE) {
    return 1 + (midpoint - HIGH_ACC_KNEE) * HIGH_ACC_LINEAR_GROWTH;
  }

  const baseMultiplier = 1 + (FINAL_STRETCH_KNEE - HIGH_ACC_KNEE) * HIGH_ACC_LINEAR_GROWTH;
  return baseMultiplier * Math.exp((midpoint - FINAL_STRETCH_KNEE) * FINAL_STRETCH_EXP_GROWTH);
}

function computeEffectiveCost(currentAcc: number, targetAcc: number, levelPenalty: number): number {
  const deltaAcc = targetAcc - currentAcc;
  if (!Number.isFinite(deltaAcc) || deltaAcc <= EPS) return 0;

  const accDifficultyMultiplier = computeAccDifficultyMultiplier(currentAcc, targetAcc);
  return deltaAcc * Math.max(1, accDifficultyMultiplier) * Math.max(1, levelPenalty);
}

// 单侧 ROI 缺失时仍返回稳定数值，避免面板层无法解释结构失衡方向。
function computeImbalanceRatio(bestRoiTop27: number, bestRoiTop3Phi: number): number {
  const hasTop27 = bestRoiTop27 > EPS;
  const hasTop3Phi = bestRoiTop3Phi > EPS;

  if (!hasTop27 && !hasTop3Phi) return 1;
  if (hasTop27 && !hasTop3Phi) return Number.POSITIVE_INFINITY;
  if (!hasTop27 && hasTop3Phi) return 0;
  return bestRoiTop27 / bestRoiTop3Phi;
}

export function resolveLilithStructureStatus(
  bestRoiTop27: number,
  bestRoiTop3Phi: number,
  threshold = DEFAULT_LILITH_IMBALANCE_THRESHOLD,
): LilithStructureStatus {
  const hasTop27 = bestRoiTop27 > EPS;
  const hasTop3Phi = bestRoiTop3Phi > EPS;

  if (!hasTop27 && !hasTop3Phi) return 'insufficient';
  if (hasTop27 && !hasTop3Phi) return 'top3phi_low';
  if (!hasTop27 && hasTop3Phi) return 'top27_low';

  const safeThreshold = Number.isFinite(threshold) && threshold > 1 ? threshold : DEFAULT_LILITH_IMBALANCE_THRESHOLD;
  const ratio = bestRoiTop27 / bestRoiTop3Phi;
  if (ratio >= safeThreshold) return 'top27_low';
  if (ratio <= 1 / safeThreshold) return 'top3phi_low';
  return 'balanced';
}

function computeQuota(status: LilithStructureStatus, limit: number): LilithRecommendationQuota {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : DEFAULT_LILITH_RECOMMENDATION_LIMIT;

  const baseWeights: Record<Exclude<LilithStructureStatus, 'insufficient'>, [number, number]> = {
    top27_low: [6, 2],
    top3phi_low: [2, 6],
    balanced: [4, 4],
  };

  if (status === 'insufficient') {
    return { total: safeLimit, top27: 0, top3phi: 0 };
  }

  const [weightTop27, weightTop3phi] = baseWeights[status];
  const weightSum = weightTop27 + weightTop3phi;
  const top27 = Math.round((safeLimit * weightTop27) / weightSum);
  const top3phi = Math.max(0, safeLimit - top27);
  return { total: safeLimit, top27, top3phi };
}

function compareCandidates(a: LilithRecommendationItem, b: LilithRecommendationItem): number {
  if (a.roi !== b.roi) return b.roi - a.roi;
  if (a.deltaTotal !== b.deltaTotal) return b.deltaTotal - a.deltaTotal;
  if (a.deltaAcc !== b.deltaAcc) return a.deltaAcc - b.deltaAcc;
  if (a.targetAcc !== b.targetAcc) return a.targetAcc - b.targetAcc;
  return a.record.song_name.localeCompare(b.record.song_name, 'zh-CN');
}

function compareCandidatesByPotential(a: LilithRecommendationItem, b: LilithRecommendationItem): number {
  if (a.deltaTotal !== b.deltaTotal) return b.deltaTotal - a.deltaTotal;
  if (a.roi !== b.roi) return b.roi - a.roi;
  if (a.deltaAcc !== b.deltaAcc) return a.deltaAcc - b.deltaAcc;
  return a.record.song_name.localeCompare(b.record.song_name, 'zh-CN');
}

function pickWithQuota(
  candidates: LilithRecommendationItem[],
  quota: LilithRecommendationQuota,
): LilithRecommendationItem[] {
  const selected: LilithRecommendationItem[] = [];
  const selectedIndex = new Set<number>();

  const pick = (count: number, predicate: (item: LilithRecommendationItem) => boolean) => {
    if (count <= 0) return;
    for (const item of candidates) {
      if (selected.length >= quota.total) break;
      if (selectedIndex.has(item.sourceIndex)) continue;
      if (!predicate(item)) continue;
      selected.push(item);
      selectedIndex.add(item.sourceIndex);
      if (selected.length >= count) break;
    }
  };

  pick(quota.top27, (item) => item.deltaTop27 > EPS);
  pick(quota.top27 + quota.top3phi, (item) => item.deltaTop3Phi > EPS);
  pick(quota.total, () => true);

  return selected.slice(0, quota.total);
}

// ──────────────────────────────────────────────────────────
// 阶段2: 快速 delta 计算（二分插入代替全量排序）
// ──────────────────────────────────────────────────────────

/** 预排序后的基线缓存，用于多目标采样时快速计算 delta */
type BaselineCache = {
  allRksSorted: number[];
  phiRksSorted: number[];
};

function buildBaselineCache(records: RksRecord[]): BaselineCache {
  const allRks = records
    .map((r) => normalizeFiniteNumber(r.rks) ?? 0)
    .filter((v) => v > 0)
    .sort((a, b) => b - a);

  const phiRks = records
    .filter(isPhiRecord)
    .map((r) => normalizeFiniteNumber(r.rks) ?? 0)
    .filter((v) => v > 0)
    .sort((a, b) => b - a);

  return {
    allRksSorted: allRks,
    phiRksSorted: phiRks,
  };
}

/**
 * 快速计算替换 oldRks→newRks 后 topN 总和的变化量。
 * 在降序排列的数组中，用二分查找定位 old 和 new 的位置来计算 delta。
 */
function fastComputeDelta(
  sorted: number[],
  oldRks: number,
  newRks: number,
  topN: number,
): number {
  if (topN <= 0) return 0;
  if (newRks <= oldRks + EPS) return 0;

  // 在降序数组中找到 oldRks 的位置（第一个 <= oldRks 的位置）
  const findOldIndex = (): number => {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] > oldRks + EPS) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  // 在降序数组中找到 newRks 应插入的位置
  const findNewIndex = (): number => {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] > newRks + EPS) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const oldIdx = findOldIndex();
  const newIdx = findNewIndex();
  const currentTopCount = Math.min(topN, sorted.length);
  const oldInTop = oldIdx < currentTopCount;
  const rankingHasSpace = sorted.length < topN;

  // 原记录本就在榜内，提升后只会替换自己。
  if (oldInTop) {
    return newRks - oldRks;
  }

  // 榜单未满时，新记录进入榜单不会挤掉其他条目。
  if (rankingHasSpace) {
    return newRks;
  }

  // 榜单已满时，只有进入 topN 的记录才会带来净增量。
  if (newIdx >= topN) return 0;

  const kicked = sorted[topN - 1] ?? 0;
  return newRks - kicked;
}

/**
 * 使用基线缓存快速计算某条记录达到 targetAcc 后的 delta。
 */
function fastComputePoolDeltas(
  cache: BaselineCache,
  record: RksRecord,
  targetAcc: number,
): { deltaTop27: number; deltaTop3Phi: number } | null {
  const targetRks = computeRksByAcc(targetAcc, record.difficulty_value);
  if (!Number.isFinite(targetRks) || targetRks <= record.rks + EPS) return null;

  const oldRks = record.rks;
  const isCurrentPhi = isPhiRecord(record);
  const isTargetPhi = targetAcc >= 100 - EPS;

  const deltaTop27 = fastComputeDelta(cache.allRksSorted, oldRks, targetRks, TOP27_COUNT);

  let deltaTop3Phi = 0;
  if (isCurrentPhi) {
    // 已经是 Phi，直接替换
    deltaTop3Phi = fastComputeDelta(cache.phiRksSorted, oldRks, targetRks, TOP3_PHI_COUNT);
  } else if (isTargetPhi) {
    // 新进入 Phi 池：在 phiRksSorted 中插入 targetRks（oldRks=0 表示原来不存在）
    deltaTop3Phi = fastComputeDelta(cache.phiRksSorted, 0, targetRks, TOP3_PHI_COUNT);
  }
  // 如果既不是当前 Phi 也不是目标 Phi，则 deltaTop3Phi = 0

  return { deltaTop27, deltaTop3Phi };
}

// ──────────────────────────────────────────────────────────
// 阶段2: 多目标采样
// ──────────────────────────────────────────────────────────

function generateCandidateTargets(
  record: RksRecord,
  index: number,
  cache: BaselineCache,
  profile: LilithPlayerProfile,
): { best: LilithRecommendationItem; alternatives: CandidateTarget[] } | null {
  const pushAcc = normalizeFiniteNumber(record.push_acc);
  if (pushAcc === null) return null;
  if (record.unreachable === true) return null;
  if (record.already_phi === true) return null;

  const pushAccClamped = clampTargetAcc(pushAcc);
  if (!Number.isFinite(pushAccClamped) || pushAccClamped < 70) return null;
  if (pushAccClamped - record.acc <= EPS) return null;

  // 生成候选目标点
  const candidateAccs: Array<{ acc: number; label: CandidateTargetLabel }> = [];

  // 1. 踩线点
  candidateAccs.push({ acc: pushAccClamped, label: 'push_line' });

  // 2. 超额 +1%
  const plus1 = Math.min(pushAccClamped + 1, 100);
  if (plus1 - pushAccClamped > EPS && plus1 - record.acc > EPS) {
    candidateAccs.push({ acc: plus1, label: 'plus_1' });
  }

  // 3. 超额 +2%
  const plus2 = Math.min(pushAccClamped + 2, 100);
  if (plus2 - plus1 > EPS && plus2 - record.acc > EPS) {
    candidateAccs.push({ acc: plus2, label: 'plus_2' });
  }

  // 4. Phi 点（如果不是 unreachable 且踩线点不是 100）
  if (pushAccClamped < 100 - EPS && 100 - record.acc > EPS) {
    candidateAccs.push({ acc: 100, label: 'phi' });
  }

  // 5. 解析最优点：在 [pushAcc, 100] 区间等距采样
  const sampleLow = pushAccClamped;
  const sampleHigh = 100;
  if (sampleHigh - sampleLow > 0.5) {
    const step = (sampleHigh - sampleLow) / (MULTI_TARGET_SAMPLE_COUNT + 1);
    for (let i = 1; i <= MULTI_TARGET_SAMPLE_COUNT; i++) {
      const sampleAcc = Math.min(sampleLow + step * i, 100);
      // 避免与已有点太接近
      const tooClose = candidateAccs.some((c) => Math.abs(c.acc - sampleAcc) < 0.2);
      if (!tooClose && sampleAcc - record.acc > EPS) {
        candidateAccs.push({ acc: sampleAcc, label: 'optimal' });
      }
    }
  }

  // 评估每个候选目标
  const evaluatedTargets: CandidateTarget[] = [];

  for (const { acc: targetAcc, label } of candidateAccs) {
    const targetRks = computeRksByAcc(targetAcc, record.difficulty_value);
    if (!Number.isFinite(targetRks) || targetRks <= record.rks + EPS) continue;

    const deltaAcc = targetAcc - record.acc;
    if (!Number.isFinite(deltaAcc) || deltaAcc <= EPS) continue;

    const deltas = fastComputePoolDeltas(cache, record, targetAcc);
    if (!deltas) continue;

    const { deltaTop27, deltaTop3Phi } = deltas;
    const deltaTotal = (deltaTop27 + deltaTop3Phi) / TOTAL_RKS_COUNT;
    if (!Number.isFinite(deltaTotal) || deltaTotal <= EPS) continue;

    const pool = classifyPool(deltaTop27, deltaTop3Phi);
    if (!pool) continue;

    const levelPenalty = computePlayerLevelPenalty(record.difficulty_value, targetAcc, pool, profile);
    const effectiveCost = computeEffectiveCost(record.acc, targetAcc, levelPenalty);
    const roi = deltaTotal / Math.max(0.01, effectiveCost);
    if (!Number.isFinite(roi) || roi <= EPS) continue;

    evaluatedTargets.push({
      targetAcc,
      targetRks,
      deltaAcc,
      deltaTop27,
      deltaTop3Phi,
      deltaTotal,
      roi,
      pool,
      label,
    });
  }

  if (evaluatedTargets.length === 0) return null;

  // 选出 ROI 最优的作为主推荐
  let bestIdx = 0;
  for (let i = 1; i < evaluatedTargets.length; i++) {
    if (evaluatedTargets[i].roi > evaluatedTargets[bestIdx].roi + EPS) {
      bestIdx = i;
    } else if (
      Math.abs(evaluatedTargets[i].roi - evaluatedTargets[bestIdx].roi) <= EPS &&
      evaluatedTargets[i].deltaTotal > evaluatedTargets[bestIdx].deltaTotal
    ) {
      bestIdx = i;
    }
  }

  const best = evaluatedTargets[bestIdx];
  const alternatives = evaluatedTargets.filter((_, i) => i !== bestIdx);

  return {
    best: {
      record,
      sourceIndex: index,
      targetAcc: best.targetAcc,
      targetRks: best.targetRks,
      deltaAcc: best.deltaAcc,
      deltaTop27: best.deltaTop27,
      deltaTop3Phi: best.deltaTop3Phi,
      deltaTotal: best.deltaTotal,
      roi: best.roi,
      pool: best.pool,
      targetLabel: best.label,
      alternativeTargets: alternatives.length > 0 ? alternatives : undefined,
    },
    alternatives: evaluatedTargets,
  };
}

export function buildLilithRecommendations(records: RksRecord[], options?: BuildOptions): LilithRecommendationResult {
  const limit = Number.isFinite(options?.limit ?? DEFAULT_LILITH_RECOMMENDATION_LIMIT)
    ? Math.max(1, Math.floor(options?.limit ?? DEFAULT_LILITH_RECOMMENDATION_LIMIT))
    : DEFAULT_LILITH_RECOMMENDATION_LIMIT;
  const threshold = Number.isFinite(options?.imbalanceThreshold ?? DEFAULT_LILITH_IMBALANCE_THRESHOLD)
    ? options?.imbalanceThreshold ?? DEFAULT_LILITH_IMBALANCE_THRESHOLD
    : DEFAULT_LILITH_IMBALANCE_THRESHOLD;

  const cache = buildBaselineCache(records);
  const playerProfile = buildPlayerProfile(records);
  const candidates: LilithRecommendationItem[] = [];

  records.forEach((record, index) => {
    const result = generateCandidateTargets(record, index, cache, playerProfile);
    if (result) {
      candidates.push(result.best);
    }
  });

  // 效率之选：按 ROI 降序
  candidates.sort(compareCandidates);

  // 阶段4: 带最低收益门槛的 bestROI
  let bestRoiTop27 = 0;
  let bestRoiTop3Phi = 0;
  for (const item of candidates) {
    if (item.deltaTotal < MIN_MEANINGFUL_DELTA) continue;
    if (item.deltaTop27 > EPS) bestRoiTop27 = Math.max(bestRoiTop27, item.roi);
    if (item.deltaTop3Phi > EPS) bestRoiTop3Phi = Math.max(bestRoiTop3Phi, item.roi);
  }

  const status = resolveLilithStructureStatus(bestRoiTop27, bestRoiTop3Phi, threshold);
  const quota = computeQuota(status, limit);
  const recommendations = pickWithQuota(candidates, quota);
  const imbalanceRatio = computeImbalanceRatio(bestRoiTop27, bestRoiTop3Phi);

  // 阶段5: 潜力之选 — 按 deltaTotal 降序
  const potentialAllCandidates = [...candidates].sort(compareCandidatesByPotential);
  const potentialRecommendations = pickWithQuota(potentialAllCandidates, quota);

  return {
    recommendations,
    allCandidates: candidates,
    potentialAllCandidates,
    potentialRecommendations,
    status,
    quota,
    bestRoiTop27,
    bestRoiTop3Phi,
    imbalanceRatio,
  };
}
