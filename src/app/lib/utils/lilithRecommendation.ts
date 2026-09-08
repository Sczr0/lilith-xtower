import type { RksRecord } from '../types/score';

export const DEFAULT_LILITH_RECOMMENDATION_LIMIT = 8;
export const DEFAULT_LILITH_IMBALANCE_THRESHOLD = 1.8;
// 阶段7: 潜力之选——可行上限：目标 ACC 超出玩家稳定水平的允许上限。
// 超出该上限的目标（纯神经刀/水平跃迁）不会进入潜力视图。
export const DEFAULT_POTENTIAL_OVER_REACH_CAP = 2.5;
// 阶段7: 潜力之选——定数水平惩罚上限：显著超出玩家胜任水平的目标同样剔除
// （稳定曲线对高定数谱面可能回退到全局中位数，需用锚点惩罚兜底）。
export const DEFAULT_POTENTIAL_MAX_LEVEL_PENALTY = 2.0;
// ── 阶段8: 高定数绝对 ACC 天花板 + 能力证明 + 单次提升上限 ──
// 规则1：以玩家 RKS + 1.0 为基准定数 T，绝对 ACC 天花板（φ 目标豁免）
export const DEFAULT_ABSOLUTE_ACC_CEILING = 98.5; // T 处的天花板基准
export const DEFAULT_CEILING_UP_SLOPE = 0.8; // 定数每高于 T 1.0 点，天花板下降多少
export const DEFAULT_CEILING_DOWN_SLOPE = 0.5; // 定数每低于 T 1.0 点，天花板上升多少（封顶 100）
export const DEFAULT_CEILING_PROOF_RAISE = 0.5; // 能力证明成立时的放宽幅度
// 规则2：能力证明——band = [T − PROOF_BAND_HALF_WIDTH, ∞) 内至少 N 条记录
// （定数与谱面 RKS 均落在 band 内，隐含近-φ 水平）
export const DEFAULT_PROOF_BAND_HALF_WIDTH = 0.2;
export const DEFAULT_PROOF_MIN_COUNT = 2;
// 规则3：单次提升上限——超过玩家 RKS + 0.5 后指数递减
export const DEFAULT_JUMP_BASE = 1.5; // 刚好跨过门槛时的最大单次提升（ACC 百分点）
export const DEFAULT_JUMP_GAP_BASE = 0.5; // 门槛：定数 − 玩家 RKS > 0.5 开始惩罚
export const DEFAULT_JUMP_DECAY = 1.0; // 指数衰减系数
// 效率视图的软惩罚乘子（潜力视图为硬过滤）
export const DEFAULT_CEILING_VIOLATION_FACTOR = 3.0; // 每超出天花板 1 点，成本 ×(1+3)
export const DEFAULT_JUMP_VIOLATION_FACTOR = 2.0; // 每超出单次上限 1 点，成本 ×(1+2)

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
const ACC_COST_POWER = 4;
const ACC_COST_HIGH_BOOST = 8;
const ACC_COST_BOOST_KNEE = 99;
const ACC_COST_REF = 40;
const ACC_COST_OFFSET = 55;
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
// 高定数锚点的 ACC 门槛：低于此 ACC 的记录视为"尝试但未胜任"，不作为水平锚点
const HIGH_CONST_ACC_THRESHOLD = 97;
// 阶段6: 稳定水平（可持续发挥）相关
const STABLE_BUCKET_WIDTH = 0.5; // 定数分桶宽度
const STABLE_BUCKET_MIN_SAMPLES = 3; // 桶内至少多少条记录才视为可靠
const STABLE_NEAREST_MAX_GAP = 1.0; // 回退：最近可靠桶的最大定数距离
const STABLE_MIN_ACC = 70; // 参与稳定估计的最低 ACC
const STABLE_FILL_MARGIN = 1.0; // 补分判定：当前 ACC 低于稳定水平至少这么多才建议
const GODRUN_ACC_GAP = 1.0; // 目标超过稳定水平这么多 → 标记"需超常发挥"
const OVER_REACH_LINEAR_FACTOR = 0.8; // 超出稳定水平的线性成本系数
const OVER_REACH_QUADRATIC_FACTOR = 1.5; // 超出稳定水平的二次成本系数

export type LilithPool = 'top27' | 'top3phi' | 'dual';
export type LilithStructureStatus = 'top27_low' | 'top3phi_low' | 'balanced' | 'insufficient';
export type CandidateTargetLabel = 'stable' | 'push_line' | 'plus_1' | 'plus_2' | 'phi' | 'optimal';

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
  /** 目标超出玩家稳定水平多少（ACC 百分点），0 表示稳定可达 */
  overReach: number;
  /** 目标是否需要超常发挥（神经刀）才能达成 */
  needsGodRun: boolean;
  /** 该目标的定数水平惩罚（显著高于玩家胜任能力时 > 1） */
  levelPenalty: number;
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
  /** 目标是否需超常发挥（超出稳定水平 GODRUN_ACC_GAP 以上） */
  needsGodRun: boolean;
  /** 目标超出玩家稳定水平多少（ACC 百分点），0 表示稳定可达 */
  overReach: number;
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
  /** 潜力视图全量候选：每首曲目在其可行上限内的最大 Δ总RKS 目标 */
  potentialAllCandidates: LilithRecommendationItem[];
  /** 按 deltaTotal 排序的潜力推荐（可行性受限的最大增量视图） */
  potentialRecommendations: LilithRecommendationItem[];
  /** 潜力目标的超出稳定水平上限（百分点），用于 UI 说明与筛选 */
  potentialOverReachCap: number;
  /** 潜力目标的定数水平惩罚上限（显著超出玩家胜任水平的目标会被剔除） */
  potentialMaxLevelPenalty: number;
  /** 玩家 RKS 参照（规则1/3 的基准），记录计算或 BuildOptions 覆盖 */
  playerRks: number;
  /** 能力证明是否成立（band 内 ≥N 条定数与谱面 RKS 均达标的记录） */
  proofedCeiling: boolean;
  status: LilithStructureStatus;
  quota: LilithRecommendationQuota;
  bestRoiTop27: number;
  bestRoiTop3Phi: number;
  imbalanceRatio: number;
}

type BuildOptions = {
  limit?: number;
  imbalanceThreshold?: number;
  potentialOverReachCap?: number;
  potentialMaxLevelPenalty?: number;
  /** 覆盖玩家 RKS 参照（测试或面板透传后端 serverRks.totalRks 时使用） */
  playerRks?: number;
};

/** 稳定水平估计结果：acc 为持续可达水平，reliable 表示是否来自可靠桶/近邻（而非全局中位数回退） */
type StableAccEstimate = {
  acc: number;
  reliable: boolean;
};

/** 阶段8 推荐策略：以玩家 RKS 为参照的绝对天花板与单次提升上限 */
type LilithPolicy = {
  playerRks: number;
  proofed: boolean;
  /** 规则1：绝对 ACC 天花板（φ 目标由调用方豁免） */
  absoluteCeiling: (constant: number) => number;
  /** 规则3：单次提升上限（已含稳定性豁免：可靠估计下允许练到自身稳定水平） */
  maxAllowedDelta: (constant: number, currentAcc: number) => number;
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
  // 阶段6: 稳定ACC曲线（按定数估计玩家可持续水平，区别于峰值水平）
  stableAccByConstant: (constant: number) => StableAccEstimate;
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

// 阶段6: 基于玩家自身记录估计"稳定ACC曲线"——每个定数区间常态能打到的 ACC，
// 用分桶中位数（对神经刀/手滑等异常值稳健），样本不足时回退到最近可靠桶或全局中位数。
// 返回的 reliable 标记估计来源：可靠桶/近邻回退为 true，全局中位数回退为 false
// （后者用于防污染——全局回退不代表玩家在该定数区间真实可达）。
function buildStableAccEstimator(records: RksRecord[]): (constant: number) => StableAccEstimate {
  const samples: Array<{ constant: number; acc: number }> = [];
  for (const r of records) {
    const constant = normalizeFiniteNumber(r.difficulty_value);
    const acc = normalizeFiniteNumber(r.acc);
    if (constant !== null && constant > 0 && acc !== null && acc >= STABLE_MIN_ACC && acc <= 100) {
      samples.push({ constant, acc });
    }
  }
  if (samples.length === 0) return () => ({ acc: 100, reliable: false });

  const buckets = new Map<number, number[]>();
  for (const s of samples) {
    const key = Math.round(s.constant / STABLE_BUCKET_WIDTH) * STABLE_BUCKET_WIDTH;
    const list = buckets.get(key) ?? [];
    list.push(s.acc);
    buckets.set(key, list);
  }

  const median = (arr: number[]): number => {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const reliable = [...buckets.entries()]
    .filter(([, arr]) => arr.length >= STABLE_BUCKET_MIN_SAMPLES)
    .map(([key, arr]) => ({ key, median: median(arr) }))
    .sort((a, b) => a.key - b.key);

  const globalMedian = median(samples.map((s) => s.acc));

  return (constant: number): StableAccEstimate => {
    const key = Math.round(constant / STABLE_BUCKET_WIDTH) * STABLE_BUCKET_WIDTH;
    const direct = reliable.find((b) => b.key === key);
    if (direct) return { acc: direct.median, reliable: true };

    let nearest: { key: number; median: number } | null = null;
    let bestGap = Infinity;
    for (const b of reliable) {
      const gap = Math.abs(b.key - key);
      if (gap < bestGap) {
        bestGap = gap;
        nearest = b;
      }
    }
    if (nearest !== null && bestGap <= STABLE_NEAREST_MAX_GAP) {
      return { acc: nearest.median, reliable: true };
    }

    return { acc: globalMedian, reliable: false };
  };
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

  // highConstAnchor：取 ACC ≥ 93% 的记录中定数最高的 Top5 均值
  // 低于此 ACC 的记录视为"尝试过但未胜任"，不应拉高锚点
  const qualifiedForConst = records.filter((r) => r.acc >= HIGH_CONST_ACC_THRESHOLD - EPS);
  const highConstAnchor = averageTopDifficultyValues(qualifiedForConst, HIGH_CONST_SAMPLE_COUNT) ?? (bestPeak?.difficulty_value ?? 0);

  return {
    bestPeakConstant: bestPeak?.difficulty_value ?? 0,
    apPeakConstant: apPeak?.difficulty_value ?? null,
    nearApLevel: averageTopDifficultyValues(nearApRecords, PROFILE_LEVEL_SAMPLE_COUNT),
    apLevel: averageTopDifficultyValues(phiRecords, PROFILE_LEVEL_SAMPLE_COUNT),
    closeRate,
    highAccAnchor,
    highConstAnchor,
    stableAccByConstant: buildStableAccEstimator(records),
  };
}

// ──────────────────────────────────────────────────────────
// 阶段8: 玩家 RKS 参照 / 能力证明 / 绝对天花板 / 单次提升上限
// ──────────────────────────────────────────────────────────

/** 按 B30 口径计算玩家 RKS：满 30 首时与游戏显示一致；不足时按已有数量归一，
 *  避免稀疏样本把参照点压得过低导致规则失真（测试/边缘场景）。 */
function computePlayerRks(cache: BaselineCache): number {
  const top27 = cache.allRksSorted.slice(0, TOP27_COUNT);
  const top3Phi = cache.phiRksSorted.slice(0, TOP3_PHI_COUNT);
  const total = top27.length + top3Phi.length;
  if (total === 0) return 0;
  const sum = top27.reduce((s, v) => s + v, 0) + top3Phi.reduce((s, v) => s + v, 0);
  return sum / Math.min(TOTAL_RKS_COUNT, total);
}

/**
 * 规则2 能力证明：band = [T − PROOF_BAND_HALF_WIDTH, +∞) 内至少 PROOF_MIN_COUNT 条记录，
 * 且每条记录的定数与谱面 RKS 都落在 band 内（示例：定数 16.1、谱面 RKS 15.9）。
 * 高谱面 RKS 隐含近-φ 水平，因此证明成立时允许略微提高天花板。
 */
function hasProofedCeiling(records: RksRecord[], playerRks: number): boolean {
  if (!Number.isFinite(playerRks) || playerRks <= 0) return false;
  const bandThreshold = playerRks + 1.0 - DEFAULT_PROOF_BAND_HALF_WIDTH;
  let count = 0;
  for (const r of records) {
    const constant = normalizeFiniteNumber(r.difficulty_value);
    const rks = normalizeFiniteNumber(r.rks);
    if (constant !== null && constant > 0 && rks !== null && rks > 0) {
      if (constant >= bandThreshold - EPS && rks >= bandThreshold - EPS) {
        count += 1;
        if (count >= DEFAULT_PROOF_MIN_COUNT) return true;
      }
    }
  }
  return false;
}

/**
 * 规则1 绝对 ACC 天花板：以 T = playerRks + 1.0 为基准；
 * 定数高于 T 每 1.0 点下降 CEILING_UP_SLOPE，低于 T 每 1.0 点上升 CEILING_DOWN_SLOPE（封顶 100）。
 * 能力证明成立时上浮 CEILING_PROOF_RAISE。φ（100%）目标由调用方豁免。
 */
function computeAbsoluteAccCeiling(constant: number, playerRks: number, proofed: boolean): number {
  if (!Number.isFinite(constant) || constant <= 0) return 100;
  if (!Number.isFinite(playerRks) || playerRks <= 0) return 100;

  const threshold = playerRks + 1.0;
  const excess = Math.max(0, constant - threshold);
  const under = Math.max(0, threshold - constant);
  let ceiling =
    DEFAULT_ABSOLUTE_ACC_CEILING - DEFAULT_CEILING_UP_SLOPE * excess + DEFAULT_CEILING_DOWN_SLOPE * under;
  if (proofed) ceiling += DEFAULT_CEILING_PROOF_RAISE;
  return Math.min(100, Math.max(70, ceiling));
}

/**
 * 规则3 单次提升上限：定数超过 playerRks + JUMP_GAP_BASE 后，
 * 上限 = JUMP_BASE × e^(−JUMP_DECAY × 超出量)，指数递减；未超门槛则不限制。
 */
function computeMaxJump(constant: number, playerRks: number): number {
  if (!Number.isFinite(constant) || constant <= 0) return Number.POSITIVE_INFINITY;
  if (!Number.isFinite(playerRks) || playerRks <= 0) return Number.POSITIVE_INFINITY;

  const gap = constant - (playerRks + DEFAULT_JUMP_GAP_BASE);
  // 定数未超过玩家 RKS + 0.5 → 不限制；恰在门槛 → 上限 = JUMP_BASE（1.5）起指数递减
  if (gap <= -EPS) return Number.POSITIVE_INFINITY;
  return DEFAULT_JUMP_BASE * Math.exp(-DEFAULT_JUMP_DECAY * Math.max(0, gap));
}

/** 稳定性豁免：稳定水平估计可靠（可靠桶/近邻回退）时，允许一次练到自身稳定水平；全局回退不豁免。 */
function computeAllowedDelta(constant: number, currentAcc: number, stableEstimate: StableAccEstimate, playerRks: number): number {
  const jumpLimit = computeMaxJump(constant, playerRks);
  if (!stableEstimate.reliable) return jumpLimit;
  return Math.max(jumpLimit, Math.max(0, stableEstimate.acc - currentAcc));
}

function buildLilithPolicy(records: RksRecord[], cache: BaselineCache, profile: LilithPlayerProfile, override?: number): LilithPolicy {
  const playerRks =
    Number.isFinite(override) && (override ?? 0) >= 0
      ? (override ?? 0)
      : computePlayerRks(cache);
  const proofed = hasProofedCeiling(records, playerRks);

  return {
    playerRks,
    proofed,
    absoluteCeiling: (constant: number) => computeAbsoluteAccCeiling(constant, playerRks, proofed),
    maxAllowedDelta: (constant: number, currentAcc: number) =>
      computeAllowedDelta(constant, currentAcc, profile.stableAccByConstant(constant), playerRks),
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
  // 不再用 Math.max(anchor, bestPeakConstant)——bestPeakConstant 按 RKS 选的，
  // 可能正好是那条高定数低ACC记录本身，会消除惩罚。
  // 锚点应仅反映"玩家在该方向上的真实胜任能力"。
  const bestPenalty = computeDifficultyGapPenalty(targetConstant, anchor);

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

function computeLegacyAccDifficultyMultiplier(midpoint: number): number {
  if (!Number.isFinite(midpoint) || midpoint <= HIGH_ACC_KNEE) return 1;

  if (midpoint <= FINAL_STRETCH_KNEE) {
    return 1 + (midpoint - HIGH_ACC_KNEE) * HIGH_ACC_LINEAR_GROWTH;
  }

  const baseMultiplier = 1 + (FINAL_STRETCH_KNEE - HIGH_ACC_KNEE) * HIGH_ACC_LINEAR_GROWTH;
  return baseMultiplier * Math.exp((midpoint - FINAL_STRETCH_KNEE) * FINAL_STRETCH_EXP_GROWTH);
}

// 混合成本模型：
// 1. 保留旧曲线作为下界，避免 98~99 区间比历史实现更便宜而抬高 near-AP / Phi 的 ROI；
// 2. 在 99%+ 继续叠加基于导数特征的幂律曲线，维持最终收尾阶段的强惩罚。
function computeAccDifficultyMultiplier(currentAcc: number, targetAcc: number): number {
  if (!Number.isFinite(currentAcc) || !Number.isFinite(targetAcc) || targetAcc <= currentAcc + EPS) return 1;

  const midpoint = (currentAcc + targetAcc) / 2;
  const legacyMult = computeLegacyAccDifficultyMultiplier(midpoint);
  const u = (midpoint - ACC_COST_OFFSET) / ACC_COST_REF;
  const derivativeMult = Math.pow(u, ACC_COST_POWER);
  const overshoot = Math.max(0, midpoint - ACC_COST_BOOST_KNEE);
  const highAccBoost = 1 + ACC_COST_HIGH_BOOST * overshoot * overshoot;

  return Math.max(1, legacyMult, derivativeMult * highAccBoost);
}

export const __lilithRecommendationTestables = {
  computeAccDifficultyMultiplier,
  computeLegacyAccDifficultyMultiplier,
  computeOverReachPenalty,
  computeEffectiveCost,
  buildStableAccEstimator,
  computePlayerRks,
  hasProofedCeiling,
  computeAbsoluteAccCeiling,
  computeMaxJump,
  computeAllowedDelta,
  selectPotentialTarget,
  compareCandidatesByPotential,
};

// 阶段6: 超出玩家稳定水平的成本惩罚——目标越高于稳定水平，成本越高。
// 与绝对 ACC 幂律（所有人到 99% 都贵）正交，这是"相对玩家"的一维：
// 超出稳定水平 3% 的踩线目标会被显著降权，避免推荐依赖神经刀。
function computeOverReachPenalty(targetAcc: number, stableAcc: number): number {
  if (!Number.isFinite(targetAcc) || !Number.isFinite(stableAcc)) return 1;
  const overReach = Math.max(0, targetAcc - stableAcc);
  if (overReach <= 0) return 1;
  return 1 + OVER_REACH_LINEAR_FACTOR * overReach + OVER_REACH_QUADRATIC_FACTOR * overReach * overReach;
}

// 阶段8: 效率视图软惩罚——绝对天花板违反（φ 豁免）与单次提升超限，均折算为成本乘子。
// 潜力视图对同一规则做硬过滤；效率视图保留排序连续性，但让违规目标显著降权。
function computeCeilingViolationPenalty(targetAcc: number, absCeiling: number | undefined): number {
  if (!Number.isFinite(absCeiling) || absCeiling === undefined) return 1;
  if (absCeiling >= 100 - EPS) return 1;
  if (targetAcc >= 100 - EPS) return 1; // φ 目标豁免
  const over = targetAcc - absCeiling;
  if (over <= EPS) return 1;
  return 1 + DEFAULT_CEILING_VIOLATION_FACTOR * over;
}

function computeJumpViolationPenalty(deltaAcc: number, allowedDelta: number | undefined): number {
  if (allowedDelta === undefined || !Number.isFinite(allowedDelta)) return 1;
  const over = deltaAcc - allowedDelta;
  if (over <= EPS) return 1;
  return 1 + DEFAULT_JUMP_VIOLATION_FACTOR * over;
}

function computeEffectiveCost(
  currentAcc: number,
  targetAcc: number,
  levelPenalty: number,
  stableAcc: number,
  extra?: { absCeiling?: number; allowedDelta?: number },
): number {
  const deltaAcc = targetAcc - currentAcc;
  if (!Number.isFinite(deltaAcc) || deltaAcc <= EPS) return 0;

  const accDifficultyMultiplier = computeAccDifficultyMultiplier(currentAcc, targetAcc);
  const overReachPenalty = computeOverReachPenalty(targetAcc, stableAcc);
  const ceilingPenalty = computeCeilingViolationPenalty(targetAcc, extra?.absCeiling);
  const jumpPenalty = computeJumpViolationPenalty(deltaAcc, extra?.allowedDelta);
  return (
    deltaAcc
    * Math.max(1, accDifficultyMultiplier)
    * Math.max(1, levelPenalty)
    * overReachPenalty
    * ceilingPenalty
    * jumpPenalty
  );
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
  // 同样收益时，超出稳定水平更少（更可控）的目标在前
  if (a.overReach !== b.overReach) return a.overReach - b.overReach;
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
  policy: LilithPolicy,
): { best: LilithRecommendationItem; alternatives: CandidateTarget[]; evaluatedTargets: CandidateTarget[] } | null {
  if (record.unreachable === true) return null;
  if (record.already_phi === true) return null;

  const acc = record.acc;
  const stableInfo = profile.stableAccByConstant(record.difficulty_value);
  const stableAcc = stableInfo.acc;
  const pushAcc = normalizeFiniteNumber(record.push_acc);
  const pushAccClamped = pushAcc === null ? NaN : clampTargetAcc(pushAcc);
  // 阶段8: 该谱面的绝对天花板（φ 豁免在评估处处理）与单次提升上限
  const absCeiling = policy.absoluteCeiling(record.difficulty_value);
  const allowedDelta = policy.maxAllowedDelta(record.difficulty_value, acc);
  // 推分线语义：push_acc 是"让总分动一下的最低 ACC"，对已过推分线（榜内）的谱面会接近/等于当前 ACC，
  // 此时不再当作推分目标，而是走下面的补分分支。
  const hasPushTarget = Number.isFinite(pushAccClamped) && pushAccClamped >= 70 && pushAccClamped - acc > EPS;

  // 生成候选目标点
  const candidateAccs: Array<{ acc: number; label: CandidateTargetLabel; needsGodRun: boolean }> = [];

  if (hasPushTarget) {
    // 1. 稳推点：稳定水平与踩线取小。若稳定水平本身足以踩线，则稳推点=踩线点，由踩线点承担。
    const stableTarget = Math.min(pushAccClamped, stableAcc);
    if (stableTarget - acc > EPS && pushAccClamped - stableTarget > EPS) {
      candidateAccs.push({ acc: stableTarget, label: 'stable', needsGodRun: false });
    }

    // 2. 踩线点
    candidateAccs.push({
      acc: pushAccClamped,
      label: 'push_line',
      needsGodRun: pushAccClamped > stableAcc + GODRUN_ACC_GAP,
    });

    // 3. 超额 +1%
    const plus1 = Math.min(pushAccClamped + 1, 100);
    if (plus1 - pushAccClamped > EPS && plus1 - acc > EPS) {
      candidateAccs.push({ acc: plus1, label: 'plus_1', needsGodRun: plus1 > stableAcc + GODRUN_ACC_GAP });
    }

    // 4. 超额 +2%
    const plus2 = Math.min(pushAccClamped + 2, 100);
    if (plus2 - plus1 > EPS && plus2 - acc > EPS) {
      candidateAccs.push({ acc: plus2, label: 'plus_2', needsGodRun: plus2 > stableAcc + GODRUN_ACC_GAP });
    }

    // 5. Phi 点（如果不是 unreachable 且踩线点不是 100）
    if (pushAccClamped < 100 - EPS && 100 - acc > EPS) {
      candidateAccs.push({ acc: 100, label: 'phi', needsGodRun: true });
    }

    // 6. 解析最优点：在 [pushAcc, 100] 区间等距采样
    const sampleLow = pushAccClamped;
    const sampleHigh = 100;
    if (sampleHigh - sampleLow > 0.5) {
      const step = (sampleHigh - sampleLow) / (MULTI_TARGET_SAMPLE_COUNT + 1);
      for (let i = 1; i <= MULTI_TARGET_SAMPLE_COUNT; i++) {
        const sampleAcc = Math.min(sampleLow + step * i, 100);
        // 避免与已有点太接近
        const tooClose = candidateAccs.some((c) => Math.abs(c.acc - sampleAcc) < 0.2);
        if (!tooClose && sampleAcc - acc > EPS) {
          candidateAccs.push({
            acc: sampleAcc,
            label: 'optimal',
            needsGodRun: sampleAcc > stableAcc + GODRUN_ACC_GAP,
          });
        }
      }
    }
  } else if (stableAcc - acc > STABLE_FILL_MARGIN) {
    // 补分：已在榜内/已过推分线的谱面，当前 ACC 显著低于稳定水平。
    // 这是最现实的提升——本来就在打这首，练到常态水平即可，不需要神经刀。
    if (stableAcc < 100 - EPS) {
      candidateAccs.push({ acc: stableAcc, label: 'stable', needsGodRun: false });
    }
    if (100 - acc > EPS) {
      candidateAccs.push({ acc: 100, label: 'phi', needsGodRun: stableAcc < 100 - EPS });
    }
  }

  if (candidateAccs.length === 0) return null;

  // 评估每个候选目标
  const evaluatedTargets: CandidateTarget[] = [];

  for (const { acc: targetAcc, label, needsGodRun } of candidateAccs) {
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
    const effectiveCost = computeEffectiveCost(record.acc, targetAcc, levelPenalty, stableAcc, {
      absCeiling,
      allowedDelta,
    });
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
      overReach: Math.max(0, targetAcc - stableAcc),
      needsGodRun,
      levelPenalty,
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
      needsGodRun: best.needsGodRun,
      overReach: best.overReach,
      alternativeTargets: alternatives.length > 0 ? alternatives : undefined,
    },
    alternatives: evaluatedTargets,
    evaluatedTargets,
  };
}

// ──────────────────────────────────────────────────────────
// 阶段7/8: 潜力之选——可行上限（含绝对天花板与单次提升上限硬过滤）
// ──────────────────────────────────────────────────────────

/**
 * 从某曲目的全部已评估目标中，选出「可行上限」目标：
 * - 目标 ACC 超出玩家稳定水平不得超过 opts.maxOverReach（默认 2.5 个百分点）；
 * - 目标的定数水平惩罚不得超过 opts.maxLevelPenalty（默认 2.0），
 *   剔除"尝试过但未胜任"的高定数谱面（稳定曲线可能回退到全局中位数而失真）；
 * - 阶段8 规则1：目标 ACC 不得超过绝对天花板（φ 目标豁免）；
 * - 阶段8 规则3：目标单次提升不得超过 opts.allowedDelta（已含稳定性豁免）；
 * - 在满足约束的目标里取 Δ总RKS 最大者；Δ总RKS 相同时取超出更少者，再同取 ROI 更高者。
 * - 没有任何目标能满足约束时返回 null（该曲目不进入潜力视图），
 *   避免潜力之选再次推荐"纯神经刀"目标。
 */
function selectPotentialTarget(
  evaluatedTargets: CandidateTarget[],
  opts: {
    maxOverReach: number;
    maxLevelPenalty: number;
    absCeiling?: number;
    allowedDelta?: number;
  },
): CandidateTarget | null {
  const capped = evaluatedTargets.filter((target) => {
    if (target.overReach > opts.maxOverReach + EPS) return false;
    if (target.levelPenalty > opts.maxLevelPenalty + EPS) return false;
    // 规则1: 绝对 ACC 天花板（φ 目标豁免）
    if (Number.isFinite(opts.absCeiling) && target.targetAcc < 100 - EPS) {
      if (target.targetAcc > (opts.absCeiling ?? 100) + EPS) return false;
    }
    // 规则3: 单次提升上限
    if (Number.isFinite(opts.allowedDelta) && target.deltaAcc > (opts.allowedDelta ?? 0) + EPS) return false;
    return true;
  });
  if (capped.length === 0) return null;

  let best: CandidateTarget = capped[0];
  for (let i = 1; i < capped.length; i++) {
    const candidate = capped[i];
    if (candidate.deltaTotal > best.deltaTotal + EPS) {
      best = candidate;
    } else if (
      Math.abs(candidate.deltaTotal - best.deltaTotal) <= EPS &&
      candidate.overReach < best.overReach - EPS
    ) {
      best = candidate;
    } else if (
      Math.abs(candidate.deltaTotal - best.deltaTotal) <= EPS &&
      Math.abs(candidate.overReach - best.overReach) <= EPS &&
      candidate.roi > best.roi + EPS
    ) {
      best = candidate;
    }
  }
  return best;
}

/** 以潜力目标构建推荐条目；alternativeTargets 包含其余全部目标（含被效率视图选中的保守目标）。 */
function buildPotentialItem(
  record: RksRecord,
  index: number,
  evaluatedTargets: CandidateTarget[],
  potentialTarget: CandidateTarget,
): LilithRecommendationItem {
  const alternatives = evaluatedTargets.filter((target) => target !== potentialTarget);
  return {
    record,
    sourceIndex: index,
    targetAcc: potentialTarget.targetAcc,
    targetRks: potentialTarget.targetRks,
    deltaAcc: potentialTarget.deltaAcc,
    deltaTop27: potentialTarget.deltaTop27,
    deltaTop3Phi: potentialTarget.deltaTop3Phi,
    deltaTotal: potentialTarget.deltaTotal,
    roi: potentialTarget.roi,
    pool: potentialTarget.pool,
    targetLabel: potentialTarget.label,
    needsGodRun: potentialTarget.needsGodRun,
    overReach: potentialTarget.overReach,
    alternativeTargets: alternatives.length > 0 ? alternatives : undefined,
  };
}

export function buildLilithRecommendations(records: RksRecord[], options?: BuildOptions): LilithRecommendationResult {
  const limit = Number.isFinite(options?.limit ?? DEFAULT_LILITH_RECOMMENDATION_LIMIT)
    ? Math.max(1, Math.floor(options?.limit ?? DEFAULT_LILITH_RECOMMENDATION_LIMIT))
    : DEFAULT_LILITH_RECOMMENDATION_LIMIT;
  const threshold = Number.isFinite(options?.imbalanceThreshold ?? DEFAULT_LILITH_IMBALANCE_THRESHOLD)
    ? options?.imbalanceThreshold ?? DEFAULT_LILITH_IMBALANCE_THRESHOLD
    : DEFAULT_LILITH_IMBALANCE_THRESHOLD;
  const potentialCap = Number.isFinite(options?.potentialOverReachCap)
    ? (options?.potentialOverReachCap ?? DEFAULT_POTENTIAL_OVER_REACH_CAP)
    : DEFAULT_POTENTIAL_OVER_REACH_CAP;
  const potentialLevelCap = Number.isFinite(options?.potentialMaxLevelPenalty)
    ? (options?.potentialMaxLevelPenalty ?? DEFAULT_POTENTIAL_MAX_LEVEL_PENALTY)
    : DEFAULT_POTENTIAL_MAX_LEVEL_PENALTY;

  const cache = buildBaselineCache(records);
  const playerProfile = buildPlayerProfile(records);
  const policy = buildLilithPolicy(records, cache, playerProfile, options?.playerRks);
  const candidates: LilithRecommendationItem[] = [];
  const potentialCandidates: LilithRecommendationItem[] = [];

  records.forEach((record, index) => {
    const result = generateCandidateTargets(record, index, cache, playerProfile, policy);
    if (!result) return;
    candidates.push(result.best);

    // 阶段7/8: 潜力条目 = 该曲目在可行上限内的最大 Δ总RKS 目标（含绝对天花板/单次提升上限）
    const potentialTarget = selectPotentialTarget(result.evaluatedTargets, {
      maxOverReach: potentialCap,
      maxLevelPenalty: potentialLevelCap,
      absCeiling: policy.absoluteCeiling(record.difficulty_value),
      allowedDelta: policy.maxAllowedDelta(record.difficulty_value, record.acc),
    });
    if (potentialTarget) {
      potentialCandidates.push(buildPotentialItem(record, index, result.evaluatedTargets, potentialTarget));
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

  // 阶段5/7: 潜力之选 — 按可行上限内的 deltaTotal 降序（平手时更可控的目标在前）
  const potentialAllCandidates = [...potentialCandidates].sort(compareCandidatesByPotential);
  const potentialRecommendations = pickWithQuota(potentialAllCandidates, quota);

  return {
    recommendations,
    allCandidates: candidates,
    potentialAllCandidates,
    potentialRecommendations,
    potentialOverReachCap: potentialCap,
    potentialMaxLevelPenalty: potentialLevelCap,
    playerRks: policy.playerRks,
    proofedCeiling: policy.proofed,
    status,
    quota,
    bestRoiTop27,
    bestRoiTop3Phi,
    imbalanceRatio,
  };
}
