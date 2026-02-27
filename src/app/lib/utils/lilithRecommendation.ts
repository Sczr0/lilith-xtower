import type { RksRecord } from '../types/score';

export const DEFAULT_LILITH_RECOMMENDATION_LIMIT = 8;
export const DEFAULT_LILITH_IMBALANCE_THRESHOLD = 1.8;

const TOP27_COUNT = 27;
const TOP3_PHI_COUNT = 3;
const TOTAL_RKS_COUNT = 30;
const EPS = 1e-6;

export type LilithPool = 'top27' | 'top3phi' | 'dual';
export type LilithStructureStatus = 'top27_low' | 'top3phi_low' | 'balanced' | 'insufficient';

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
}

export interface LilithRecommendationQuota {
  total: number;
  top27: number;
  top3phi: number;
}

export interface LilithRecommendationResult {
  recommendations: LilithRecommendationItem[];
  allCandidates: LilithRecommendationItem[];
  status: LilithStructureStatus;
  quota: LilithRecommendationQuota;
  bestRoiTop27: number;
  bestRoiTop3Phi: number;
  imbalanceRatio: number | null;
}

type BuildOptions = {
  limit?: number;
  imbalanceThreshold?: number;
};

type PoolTotals = {
  top27: number;
  top3phi: number;
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

function sumTop(values: number[], count: number): number {
  if (count <= 0 || values.length === 0) return 0;
  return [...values]
    .sort((a, b) => b - a)
    .slice(0, count)
    .reduce((sum, value) => sum + value, 0);
}

function isPhiRecord(record: RksRecord): boolean {
  return record.already_phi === true || record.acc >= 100 - EPS;
}

function computePoolTotals(records: RksRecord[]): PoolTotals {
  const top27 = sumTop(
    records
      .map((record) => normalizeFiniteNumber(record.rks) ?? 0)
      .filter((value) => Number.isFinite(value) && value > 0),
    TOP27_COUNT,
  );

  const top3phi = sumTop(
    records
      .filter(isPhiRecord)
      .map((record) => normalizeFiniteNumber(record.rks) ?? 0)
      .filter((value) => Number.isFinite(value) && value > 0),
    TOP3_PHI_COUNT,
  );

  return { top27, top3phi };
}

function classifyPool(deltaTop27: number, deltaTop3Phi: number): LilithPool | null {
  const top27Positive = deltaTop27 > EPS;
  const top3Positive = deltaTop3Phi > EPS;
  if (top27Positive && top3Positive) return 'dual';
  if (top27Positive) return 'top27';
  if (top3Positive) return 'top3phi';
  return null;
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

export function buildLilithRecommendations(records: RksRecord[], options?: BuildOptions): LilithRecommendationResult {
  const limit = Number.isFinite(options?.limit ?? DEFAULT_LILITH_RECOMMENDATION_LIMIT)
    ? Math.max(1, Math.floor(options?.limit ?? DEFAULT_LILITH_RECOMMENDATION_LIMIT))
    : DEFAULT_LILITH_RECOMMENDATION_LIMIT;
  const threshold = Number.isFinite(options?.imbalanceThreshold ?? DEFAULT_LILITH_IMBALANCE_THRESHOLD)
    ? options?.imbalanceThreshold ?? DEFAULT_LILITH_IMBALANCE_THRESHOLD
    : DEFAULT_LILITH_IMBALANCE_THRESHOLD;

  const baseTotals = computePoolTotals(records);
  const candidates: LilithRecommendationItem[] = [];

  records.forEach((record, index) => {
    const rawTargetAcc = normalizeFiniteNumber(record.push_acc);
    if (rawTargetAcc === null) return;
    if (record.unreachable === true) return;
    if (record.already_phi === true) return;

    const targetAcc = clampTargetAcc(rawTargetAcc);
    if (!Number.isFinite(targetAcc) || targetAcc < 70) return;

    const deltaAcc = targetAcc - record.acc;
    if (!Number.isFinite(deltaAcc) || deltaAcc <= EPS) return;

    const targetRks = computeRksByAcc(targetAcc, record.difficulty_value);
    if (!Number.isFinite(targetRks) || targetRks <= record.rks + EPS) return;

    const nextRecords = records.slice();
    nextRecords[index] = {
      ...record,
      acc: targetAcc,
      rks: targetRks,
      already_phi: targetAcc >= 100 - EPS,
    };

    const nextTotals = computePoolTotals(nextRecords);
    const deltaTop27 = nextTotals.top27 - baseTotals.top27;
    const deltaTop3Phi = nextTotals.top3phi - baseTotals.top3phi;
    const deltaTotal = (deltaTop27 + deltaTop3Phi) / TOTAL_RKS_COUNT;
    if (!Number.isFinite(deltaTotal) || deltaTotal <= EPS) return;

    const pool = classifyPool(deltaTop27, deltaTop3Phi);
    if (!pool) return;

    const roi = deltaTotal / Math.max(0.01, deltaAcc);
    if (!Number.isFinite(roi) || roi <= EPS) return;

    candidates.push({
      record,
      sourceIndex: index,
      targetAcc,
      targetRks,
      deltaAcc,
      deltaTop27,
      deltaTop3Phi,
      deltaTotal,
      roi,
      pool,
    });
  });

  candidates.sort(compareCandidates);

  let bestRoiTop27 = 0;
  let bestRoiTop3Phi = 0;
  for (const item of candidates) {
    if (item.deltaTop27 > EPS) bestRoiTop27 = Math.max(bestRoiTop27, item.roi);
    if (item.deltaTop3Phi > EPS) bestRoiTop3Phi = Math.max(bestRoiTop3Phi, item.roi);
  }

  const status = resolveLilithStructureStatus(bestRoiTop27, bestRoiTop3Phi, threshold);
  const quota = computeQuota(status, limit);
  const recommendations = pickWithQuota(candidates, quota);
  const imbalanceRatio = bestRoiTop27 > EPS && bestRoiTop3Phi > EPS ? bestRoiTop27 / bestRoiTop3Phi : null;

  return {
    recommendations,
    allCandidates: candidates,
    status,
    quota,
    bestRoiTop27,
    bestRoiTop3Phi,
    imbalanceRatio,
  };
}

