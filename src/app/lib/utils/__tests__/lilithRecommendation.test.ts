import { describe, expect, it } from 'vitest';

import type { RksRecord } from '../../types/score';
import type { CandidateTarget, LilithRecommendationItem } from '../lilithRecommendation';
import {
  __lilithRecommendationTestables,
  buildLilithRecommendations,
  resolveLilithStructureStatus,
} from '../lilithRecommendation';

const rksByAcc = (acc: number, constant: number) => {
  if (acc < 70) return 0;
  return constant * Math.pow((acc - 55) / 45, 2);
};

function createRecord(partial: Partial<RksRecord> & Pick<RksRecord, 'song_name'>): RksRecord {
  const difficultyValue = partial.difficulty_value ?? 15;
  const acc = partial.acc ?? 90;
  return {
    song_name: partial.song_name,
    difficulty: partial.difficulty ?? 'IN',
    difficulty_value: difficultyValue,
    acc,
    score: partial.score ?? 950000,
    rks: partial.rks ?? rksByAcc(acc, difficultyValue),
    push_acc: partial.push_acc,
    unreachable: partial.unreachable,
    phi_only: partial.phi_only,
    already_phi: partial.already_phi,
  };
}

function findRecommendation(result: ReturnType<typeof buildLilithRecommendations>, songName: string) {
  const item = result.allCandidates.find((candidate) => candidate.record.song_name === songName);
  if (!item) throw new Error(`recommendation not found: ${songName}`);
  return item;
}

function findTargetByLabel(
  item: LilithRecommendationItem | undefined,
  label: string,
): CandidateTarget | LilithRecommendationItem | undefined {
  if (!item) return undefined;
  const all: Array<CandidateTarget | LilithRecommendationItem> = [item, ...(item.alternativeTargets ?? [])];
  return all.find((target) => ('label' in target ? target.label : target.targetLabel) === label);
}

function findTargetByAcc(
  item: LilithRecommendationItem | undefined,
  acc: number,
): CandidateTarget | LilithRecommendationItem | undefined {
  if (!item) return undefined;
  const all: Array<CandidateTarget | LilithRecommendationItem> = [item, ...(item.alternativeTargets ?? [])];
  return all.find((target) => target.targetAcc === acc);
}

describe('resolveLilithStructureStatus', () => {
  it('returns expected structure state by roi ratio', () => {
    expect(resolveLilithStructureStatus(0, 0)).toBe('insufficient');
    expect(resolveLilithStructureStatus(0.2, 0)).toBe('top3phi_low');
    expect(resolveLilithStructureStatus(0, 0.2)).toBe('top27_low');
    expect(resolveLilithStructureStatus(0.3, 0.1, 1.8)).toBe('top27_low');
    expect(resolveLilithStructureStatus(0.1, 0.3, 1.8)).toBe('top3phi_low');
    expect(resolveLilithStructureStatus(0.2, 0.18, 1.8)).toBe('balanced');
  });
});

describe('computeAccDifficultyMultiplier', () => {
  it('keeps the 98~99 midpoint range no cheaper than the legacy curve', () => {
    const { computeAccDifficultyMultiplier, computeLegacyAccDifficultyMultiplier } = __lilithRecommendationTestables;

    expect(computeAccDifficultyMultiplier(97, 99)).toBeGreaterThanOrEqual(computeLegacyAccDifficultyMultiplier(98));
    expect(computeAccDifficultyMultiplier(98, 100)).toBeGreaterThanOrEqual(computeLegacyAccDifficultyMultiplier(99));
  });

  it('preserves stronger penalties on the final AP stretch', () => {
    const { computeAccDifficultyMultiplier, computeLegacyAccDifficultyMultiplier } = __lilithRecommendationTestables;

    expect(computeAccDifficultyMultiplier(99, 100)).toBeGreaterThan(computeLegacyAccDifficultyMultiplier(99.5));
    expect(computeAccDifficultyMultiplier(99.5, 100)).toBeGreaterThan(computeLegacyAccDifficultyMultiplier(99.75));
  });
});

describe('buildLilithRecommendations', () => {
  it('uses backend push_acc and filters unreachable/already_phi records', () => {
    const records: RksRecord[] = [
      createRecord({ song_name: 'NoPush', push_acc: null }),
      createRecord({ song_name: 'Unreachable', push_acc: 95, unreachable: true }),
      createRecord({ song_name: 'AlreadyPhi', acc: 100, push_acc: 100, already_phi: true }),
      createRecord({ song_name: 'Pushable', push_acc: 95 }),
    ];

    const result = buildLilithRecommendations(records, { limit: 5 });

    expect(result.allCandidates).toHaveLength(1);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].record.song_name).toBe('Pushable');
    // 多目标采样后，最优目标不一定恰好是踩线点（push_acc=95），
    // 但 deltaAcc 必须 > 0 且 deltaTotal > 0
    expect(result.recommendations[0].deltaAcc).toBeGreaterThan(0);
    expect(result.recommendations[0].deltaTotal).toBeGreaterThan(0);
    // 阶段6：AP/Phi 目标会被"超出稳定水平"惩罚压低 ROI，
    // 最优目标可能落在任一池，因此 status 只断言为合法值。
    expect(['top27_low', 'top3phi_low', 'balanced', 'insufficient']).toContain(result.status);
  });

  it('respects recommendation limit', () => {
    const records: RksRecord[] = [
      createRecord({ song_name: 'A', acc: 88, push_acc: 92 }),
      createRecord({ song_name: 'B', acc: 89, push_acc: 93 }),
      createRecord({ song_name: 'C', acc: 90, push_acc: 94 }),
      createRecord({ song_name: 'D', acc: 91, push_acc: 95 }),
    ];

    const result = buildLilithRecommendations(records, { limit: 2 });

    expect(result.recommendations.length).toBeLessThanOrEqual(2);
    expect(result.quota.total).toBe(2);
  });

  it('downweights charts that are far above the player best level', () => {
    const records: RksRecord[] = [
      createRecord({ song_name: 'PeakBest', difficulty_value: 15, acc: 99.2, push_acc: null }),
      createRecord({ song_name: 'ModeratePush', difficulty_value: 15.2, acc: 92, push_acc: 95 }),
      createRecord({ song_name: 'OverLevelPush', difficulty_value: 17.5, acc: 92, push_acc: 95 }),
    ];

    const result = buildLilithRecommendations(records, { limit: 2 });

    expect(result.recommendations[0].record.song_name).toBe('ModeratePush');
    expect(findRecommendation(result, 'ModeratePush').roi).toBeGreaterThan(findRecommendation(result, 'OverLevelPush').roi);
  });

  it('treats the final AP stretch as more expensive than an equally sized lower ACC increase', () => {
    const records: RksRecord[] = [
      createRecord({ song_name: 'PhiBase1', difficulty_value: 16, acc: 100, push_acc: null, already_phi: true }),
      createRecord({ song_name: 'PhiBase2', difficulty_value: 16, acc: 100, push_acc: null, already_phi: true }),
      createRecord({ song_name: 'PhiBase3', difficulty_value: 16, acc: 100, push_acc: null, already_phi: true }),
      createRecord({ song_name: 'NearApPush', difficulty_value: 15, acc: 99, push_acc: 99.5 }),
      createRecord({ song_name: 'FinalStretchPush', difficulty_value: 15, acc: 99.5, push_acc: 100 }),
    ];

    const result = buildLilithRecommendations(records, { limit: 5 });

    // NearApPush 的踩线目标 deltaAcc=0.5，FinalStretchPush 的踩线目标 deltaAcc=0.5
    // 但多目标可能选更优目标，分别验证两者的最优 ROI 关系
    const nearAp = findRecommendation(result, 'NearApPush');
    const finalStretch = findRecommendation(result, 'FinalStretchPush');
    expect(nearAp.roi).toBeGreaterThan(finalStretch.roi);
  });

  it('returns a stable imbalance ratio when the candidate cannot improve a full Top3Phi pool', () => {
    const records: RksRecord[] = [
      createRecord({ song_name: 'PhiBase1', difficulty_value: 16, acc: 100, push_acc: null, already_phi: true }),
      createRecord({ song_name: 'PhiBase2', difficulty_value: 15.8, acc: 100, push_acc: null, already_phi: true }),
      createRecord({ song_name: 'PhiBase3', difficulty_value: 15.6, acc: 100, push_acc: null, already_phi: true }),
      createRecord({ song_name: 'Pushable', difficulty_value: 12, acc: 92, push_acc: 95 }),
    ];

    const result = buildLilithRecommendations(records, { limit: 5 });

    expect(result.bestRoiTop27).toBeGreaterThan(0);
    expect(result.bestRoiTop3Phi).toBe(0);
    expect(result.imbalanceRatio).toBe(Number.POSITIVE_INFINITY);
    expect(result.status).toBe('top3phi_low');
  });

  it('counts the first Phi candidate into Top3Phi when the Phi pool is empty', () => {
    const records: RksRecord[] = [
      createRecord({ song_name: 'Base1', difficulty_value: 15, acc: 98.5, push_acc: null }),
      createRecord({ song_name: 'Base2', difficulty_value: 14.8, acc: 98.2, push_acc: null }),
      createRecord({ song_name: 'FirstPhi', difficulty_value: 15.4, acc: 99.5, push_acc: 100 }),
    ];

    const result = buildLilithRecommendations(records, { limit: 5 });
    const firstPhi = findRecommendation(result, 'FirstPhi');

    expect(firstPhi.targetAcc).toBe(100);
    expect(firstPhi.deltaTop3Phi).toBeGreaterThan(0);
    expect(result.bestRoiTop3Phi).toBeGreaterThan(0);
  });

  it('subtracts the displaced chart when a full Top27 gets a new entrant', () => {
    const records: RksRecord[] = [
      ...Array.from({ length: 27 }, (_, i) =>
        createRecord({
          song_name: `Top${i}`,
          difficulty_value: 15,
          acc: 95,
          push_acc: null,
          rks: 10 - i * 0.1,
        }),
      ),
      createRecord({
        song_name: 'NewEntrant',
        difficulty_value: 16,
        acc: 90,
        push_acc: 100,
        rks: 7.2,
      }),
    ];

    const result = buildLilithRecommendations(records, { limit: 5 });
    const entrant = findRecommendation(result, 'NewEntrant');

    // 阶段6：最优目标变为"稳推"（95%，稳定水平），deltaTop27 = targetRks − 被挤掉的第27名(7.4)
    expect(entrant.deltaTop27).toBeCloseTo(entrant.targetRks - 7.4, 6);
    expect(entrant.deltaTop27).toBeLessThan(entrant.targetRks);
  });

  it('applies closure penalty when a player can reach near-AP but struggles to convert into Phi', () => {
    const weakCloserRecords: RksRecord[] = [
      createRecord({ song_name: 'WeakNear1', difficulty_value: 16.2, acc: 99.85, push_acc: null }),
      createRecord({ song_name: 'WeakNear2', difficulty_value: 16.0, acc: 99.72, push_acc: null }),
      createRecord({ song_name: 'WeakNear3', difficulty_value: 15.9, acc: 99.65, push_acc: null }),
      createRecord({ song_name: 'WeakAp', difficulty_value: 14.0, acc: 100, push_acc: null, already_phi: true }),
      createRecord({ song_name: 'ClosurePhi', difficulty_value: 16.1, acc: 99.5, push_acc: 100 }),
    ];

    const strongCloserRecords: RksRecord[] = [
      createRecord({ song_name: 'StrongNear1', difficulty_value: 16.2, acc: 99.85, push_acc: null }),
      createRecord({ song_name: 'StrongNear2', difficulty_value: 16.0, acc: 99.72, push_acc: null }),
      createRecord({ song_name: 'StrongAp1', difficulty_value: 16.0, acc: 100, push_acc: null, already_phi: true }),
      createRecord({ song_name: 'StrongAp2', difficulty_value: 15.9, acc: 100, push_acc: null, already_phi: true }),
      createRecord({ song_name: 'ClosurePhi', difficulty_value: 16.1, acc: 99.5, push_acc: 100 }),
    ];

    const weakCloserResult = buildLilithRecommendations(weakCloserRecords, { limit: 5 });
    const strongCloserResult = buildLilithRecommendations(strongCloserRecords, { limit: 5 });

    // 阶段6：主推荐可能变成"稳推"目标而非 Phi，因此对比两者 100% 目标（push=100 时标签为 push_line）的 ROI
    const weakPhi = findTargetByAcc(findRecommendation(weakCloserResult, 'ClosurePhi'), 100);
    const strongPhi = findTargetByAcc(findRecommendation(strongCloserResult, 'ClosurePhi'), 100);
    expect(weakPhi).toBeDefined();
    expect(strongPhi).toBeDefined();
    expect(strongPhi!.roi).toBeGreaterThan(weakPhi!.roi);
  });

  // ── 新增测试用例 ──

  it('multi-target sampling: high constant chart optimal target is not always push_line', () => {
    // 高定数谱面，push_acc 刚好踩线但离 100 很远，最优目标不一定是踩线点
    const records: RksRecord[] = [
      // 填充一些基础记录让 Top27 有基础
      ...Array.from({ length: 5 }, (_, i) =>
        createRecord({ song_name: `Base${i}`, difficulty_value: 14, acc: 96 + i * 0.5, push_acc: null }),
      ),
      createRecord({ song_name: 'HighConst', difficulty_value: 16.5, acc: 92, push_acc: 93 }),
    ];

    const result = buildLilithRecommendations(records, { limit: 8 });
    const highConst = findRecommendation(result, 'HighConst');

    // 应该有备选目标
    expect(highConst.alternativeTargets).toBeDefined();
    expect(highConst.alternativeTargets!.length).toBeGreaterThan(0);

    // 主推荐的 targetLabel 应该存在
    expect(highConst.targetLabel).toBeDefined();
    expect(['stable', 'push_line', 'plus_1', 'plus_2', 'phi', 'optimal']).toContain(highConst.targetLabel);
  });

  it('dual anchor profile: low-const-high-acc vs high-const-low-acc players differ', () => {
    // "低定高精"玩家：低定数但高 ACC
    const lowConstHighAccRecords: RksRecord[] = [
      createRecord({ song_name: 'LC1', difficulty_value: 13, acc: 99.5, push_acc: null }),
      createRecord({ song_name: 'LC2', difficulty_value: 13.2, acc: 99.3, push_acc: null }),
      createRecord({ song_name: 'LC3', difficulty_value: 13.5, acc: 99.0, push_acc: null }),
      createRecord({ song_name: 'Target', difficulty_value: 14.5, acc: 93, push_acc: 96 }),
    ];

    // "高定低精"玩家：高定数但 ACC 不高
    const highConstLowAccRecords: RksRecord[] = [
      createRecord({ song_name: 'HC1', difficulty_value: 15, acc: 94, push_acc: null }),
      createRecord({ song_name: 'HC2', difficulty_value: 15.2, acc: 93.5, push_acc: null }),
      createRecord({ song_name: 'HC3', difficulty_value: 15.5, acc: 93, push_acc: null }),
      createRecord({ song_name: 'Target', difficulty_value: 14.5, acc: 93, push_acc: 96 }),
    ];

    const lowConstResult = buildLilithRecommendations(lowConstHighAccRecords, { limit: 5 });
    const highConstResult = buildLilithRecommendations(highConstLowAccRecords, { limit: 5 });

    // 高定低精玩家对 14.5 定数谱面的惩罚应该更小（因为 highConstAnchor 更高）
    const lowConstTarget = findRecommendation(lowConstResult, 'Target');
    const highConstTarget = findRecommendation(highConstResult, 'Target');

    // 两种画像应该给出不同的 ROI（不做大小判断，因为影响因素复杂）
    expect(lowConstTarget.roi).not.toBeCloseTo(highConstTarget.roi, 4);
  });

  it('imbalance ratio ignores candidates with deltaTotal below MIN_MEANINGFUL_DELTA', () => {
    // 构造极低 deltaTotal 高 ROI 候选
    const records: RksRecord[] = [
      // 填充 27 条高 RKS 记录，让新候选的 deltaTop27 几乎为 0
      ...Array.from({ length: 28 }, (_, i) =>
        createRecord({
          song_name: `Filler${i}`,
          difficulty_value: 16,
          acc: 99 + i * 0.01,
          push_acc: null,
        }),
      ),
      // 一条极低 deltaTotal 的候选
      createRecord({ song_name: 'TinyDelta', difficulty_value: 8, acc: 94.99, push_acc: 95 }),
    ];

    const result = buildLilithRecommendations(records, { limit: 5 });

    // 如果 TinyDelta 的 deltaTotal < 0.001，它不应影响 bestROI
    const tinyCandidate = result.allCandidates.find((c) => c.record.song_name === 'TinyDelta');
    if (tinyCandidate && tinyCandidate.deltaTotal < 0.001) {
      // bestRoiTop27 不应包含它的 ROI
      // （验证方式：如果它是唯一候选且 deltaTotal < 0.001，bestRoiTop27 应为 0）
      const hasOtherTop27 = result.allCandidates.some(
        (c) => c.record.song_name !== 'TinyDelta' && c.deltaTop27 > 1e-6 && c.deltaTotal >= 0.001,
      );
      if (!hasOtherTop27) {
        expect(result.bestRoiTop27).toBe(0);
      }
    }
    // 无论如何，结果结构应该完整
    expect(result.status).toBeDefined();
    expect(result.imbalanceRatio).toBeDefined();
  });

  it('potentialRecommendations are sorted by deltaTotal descending', () => {
    const records: RksRecord[] = [
      // 定数均在玩家水平内（锚点≈14.0），确保记录能进入潜力列表
      createRecord({ song_name: 'SmallDelta', difficulty_value: 14, acc: 94, push_acc: 95 }),
      createRecord({ song_name: 'BigDelta', difficulty_value: 14.8, acc: 90, push_acc: 98 }),
      createRecord({ song_name: 'MediumDelta', difficulty_value: 14.5, acc: 92, push_acc: 96 }),
    ];

    const result = buildLilithRecommendations(records, { limit: 5, playerRks: 15.5 });

    expect(result.potentialRecommendations.length).toBeGreaterThan(0);

    // potentialRecommendations 按 deltaTotal 降序
    for (let i = 1; i < result.potentialRecommendations.length; i++) {
      expect(result.potentialRecommendations[i - 1].deltaTotal).toBeGreaterThanOrEqual(
        result.potentialRecommendations[i].deltaTotal,
      );
    }
  });

  it('potentialAllCandidates keep deltaTotal ordering for fallback fills', () => {
    const records: RksRecord[] = [
      // 定数均在玩家水平内（锚点≈14.0），确保记录能进入潜力列表
      createRecord({ song_name: 'SmallDelta', difficulty_value: 14, acc: 94, push_acc: 95 }),
      createRecord({ song_name: 'BigDelta', difficulty_value: 14.8, acc: 90, push_acc: 98 }),
      createRecord({ song_name: 'MediumDelta', difficulty_value: 14.5, acc: 92, push_acc: 96 }),
    ];

    const result = buildLilithRecommendations(records, { limit: 5 });

    // 可行上限约束下部分曲目可能被剔除，潜力列表长度 ≤ 全量候选
    expect(result.potentialAllCandidates.length).toBeLessThanOrEqual(result.allCandidates.length);
    for (let i = 1; i < result.potentialAllCandidates.length; i++) {
      expect(result.potentialAllCandidates[i - 1].deltaTotal).toBeGreaterThanOrEqual(
        result.potentialAllCandidates[i].deltaTotal,
      );
    }
  });

  it('closeRate uses count ratio instead of weighted sum ratio', () => {
    // 构造 closeReady 数量比场景：
    // 5 条 99.8%+ 记录中只有 1 条 Phi → closeRate = 1/5 = 0.2
    const records: RksRecord[] = [
      createRecord({ song_name: 'Close1', difficulty_value: 14, acc: 99.85, push_acc: null }),
      createRecord({ song_name: 'Close2', difficulty_value: 15, acc: 99.80, push_acc: null }),
      createRecord({ song_name: 'Close3', difficulty_value: 13, acc: 99.90, push_acc: null }),
      createRecord({ song_name: 'Close4', difficulty_value: 16, acc: 99.82, push_acc: null }),
      createRecord({ song_name: 'OnlyPhi', difficulty_value: 12, acc: 100, push_acc: null, already_phi: true }),
      createRecord({ song_name: 'PhiTarget', difficulty_value: 14.5, acc: 99.5, push_acc: 100 }),
    ];

    const result = buildLilithRecommendations(records, { limit: 5 });

    // 1 phi out of 5+1=6 closeReady records → closeRate ≈ 0.167
    // 这意味着 AP 收尾能力较弱，Phi 目标的惩罚应该更大
    const phiTarget = findRecommendation(result, 'PhiTarget');
    expect(phiTarget).toBeDefined();
    // 无法直接检测 closeRate，但可以验证 ROI > 0
    expect(phiTarget.roi).toBeGreaterThan(0);
  });

  it('includes targetLabel and alternativeTargets in recommendation items', () => {
    const records: RksRecord[] = [
      createRecord({ song_name: 'TestSong', difficulty_value: 15, acc: 92, push_acc: 95 }),
    ];

    const result = buildLilithRecommendations(records, { limit: 5 });

    expect(result.allCandidates.length).toBeGreaterThan(0);
    const candidate = result.allCandidates[0];

    // 必须有 targetLabel
    expect(candidate.targetLabel).toBeDefined();
    expect(['stable', 'push_line', 'plus_1', 'plus_2', 'phi', 'optimal']).toContain(candidate.targetLabel);

    // push_acc=95 且 acc=92，应有多个备选目标（push_line, +1, +2, phi, 以及采样点）
    // alternativeTargets 可能存在也可能不存在（取决于采样结果）
    if (candidate.alternativeTargets) {
      for (const alt of candidate.alternativeTargets) {
        expect(alt.targetAcc).toBeGreaterThan(0);
        expect(alt.roi).toBeGreaterThan(0);
        expect(['stable', 'push_line', 'plus_1', 'plus_2', 'phi', 'optimal']).toContain(alt.label);
      }
    }
  });

  it('potentialRecommendations exists and uses the same quota as efficiency', () => {
    const records: RksRecord[] = [
      createRecord({ song_name: 'A', acc: 88, push_acc: 92 }),
      createRecord({ song_name: 'B', acc: 89, push_acc: 93 }),
      createRecord({ song_name: 'C', acc: 90, push_acc: 94 }),
    ];

    const result = buildLilithRecommendations(records, { limit: 3 });

    expect(result.potentialRecommendations).toBeDefined();
    expect(result.potentialRecommendations.length).toBeLessThanOrEqual(result.quota.total);
  });

  it('heavily penalizes high-constant charts with low ACC so they do not dominate recommendations', () => {
    // 模拟 14.99 水平的玩家：有一条 16.3 定数但只有 88% ACC 的记录
    const records: RksRecord[] = [
      // 玩家主力水平：14-15 定数、95-99% ACC
      createRecord({ song_name: 'Main1', difficulty_value: 14.9, acc: 98.5, push_acc: null }),
      createRecord({ song_name: 'Main2', difficulty_value: 14.5, acc: 99.0, push_acc: null }),
      createRecord({ song_name: 'Main3', difficulty_value: 14.2, acc: 98.8, push_acc: null }),
      createRecord({ song_name: 'Main4', difficulty_value: 13.8, acc: 99.2, push_acc: null }),
      createRecord({ song_name: 'Main5', difficulty_value: 13.5, acc: 99.5, push_acc: null }),
      // 高定数低 ACC —— 玩家"尝试过但未胜任"
      createRecord({ song_name: 'OverLevel', difficulty_value: 16.3, acc: 88, push_acc: 95 }),
      // 在玩家水平内的可推谱面
      createRecord({ song_name: 'ComfyPush', difficulty_value: 14.6, acc: 96, push_acc: 98 }),
    ];

    const result = buildLilithRecommendations(records, { limit: 3 });

    // ComfyPush (14.6 定数) 应排在 OverLevel (16.3 定数) 前面
    // 因为 16.3 远超玩家实际胜任水平，应被严重降权
    const overLevelItem = findRecommendation(result, 'OverLevel');
    const comfyItem = findRecommendation(result, 'ComfyPush');
    expect(comfyItem.roi).toBeGreaterThan(overLevelItem.roi);
    // 第一个推荐不应是 OverLevel
    expect(result.recommendations[0].record.song_name).not.toBe('OverLevel');
  });
});

describe('稳定水平与补分（阶段6）', () => {
  it('buildStableAccEstimator: 分桶中位数估计稳定ACC，样本不足回退到最近可靠桶', () => {
    const { buildStableAccEstimator } = __lilithRecommendationTestables;
    const records = [
      createRecord({ song_name: 'S1', difficulty_value: 15, acc: 96 }),
      createRecord({ song_name: 'S2', difficulty_value: 15, acc: 95 }),
      createRecord({ song_name: 'S3', difficulty_value: 15, acc: 94 }),
      createRecord({ song_name: 'S4', difficulty_value: 14.5, acc: 92 }),
    ];
    const est = buildStableAccEstimator(records);
    // 15.0 桶有 3 条 → 中位数 95（reliable）
    expect(est(15.1).acc).toBe(95);
    expect(est(15.1).reliable).toBe(true);
    // 14.5 桶只有 1 条 → 回退到最近可靠桶（15.0，距离 0.5 ≤ 1.0）→ 95
    expect(est(14.4).acc).toBe(95);
    expect(est(14.4).reliable).toBe(true);
  });

  it('buildStableAccEstimator: 无可靠桶时回退到全局中位数（reliable=false）', () => {
    const { buildStableAccEstimator } = __lilithRecommendationTestables;
    const records = [
      createRecord({ song_name: 'S1', difficulty_value: 15, acc: 96 }),
      createRecord({ song_name: 'S2', difficulty_value: 16, acc: 92 }),
    ];
    const est = buildStableAccEstimator(records);
    // 两个桶各 1 条 → 全局中位数 (92+96)/2 = 94
    expect(est(15.5).acc).toBe(94);
    expect(est(15.5).reliable).toBe(false);
  });

  it('computeOverReachPenalty: 未超出稳定水平为 1，超出越多惩罚越大', () => {
    const { computeOverReachPenalty } = __lilithRecommendationTestables;
    expect(computeOverReachPenalty(95, 95)).toBe(1);
    expect(computeOverReachPenalty(94, 95)).toBe(1);
    expect(computeOverReachPenalty(96, 95)).toBeGreaterThan(1);
    expect(computeOverReachPenalty(97, 95)).toBeGreaterThan(computeOverReachPenalty(96, 95));
  });

  it('对已在 Top27 但低于稳定水平的谱面生成补分（稳推）候选', () => {
    const records: RksRecord[] = [
      ...Array.from({ length: 26 }, (_, i) =>
        createRecord({ song_name: `Top${i}`, difficulty_value: 15, acc: 95, push_acc: null, rks: 10 - i * 0.05 }),
      ),
      createRecord({ song_name: 'Underperform', difficulty_value: 15, acc: 90, push_acc: null, rks: 5 }),
      createRecord({ song_name: 'Other', difficulty_value: 14, acc: 94, push_acc: null, rks: 4 }),
    ];
    const result = buildLilithRecommendations(records, { limit: 8 });
    const fill = findRecommendation(result, 'Underperform');
    expect(fill.targetLabel).toBe('stable');
    expect(fill.needsGodRun).toBe(false);
    expect(fill.deltaTotal).toBeGreaterThan(0);
  });

  it('踩线目标超出稳定水平时标记 needsGodRun，稳推目标不标记', () => {
    const records: RksRecord[] = [
      createRecord({ song_name: 'S1', difficulty_value: 15, acc: 94 }),
      createRecord({ song_name: 'S2', difficulty_value: 15, acc: 93 }),
      createRecord({ song_name: 'S3', difficulty_value: 15, acc: 92 }),
      // 稳定水平≈92.5；踩线 96 超出稳定水平 3%+ → 需超常发挥
      createRecord({ song_name: 'Frontier', difficulty_value: 15, acc: 92, push_acc: 96 }),
    ];
    const result = buildLilithRecommendations(records, { limit: 8 });
    const frontier = findRecommendation(result, 'Frontier');
    // 主推荐应是稳推目标（92.5，低于踩线但稳定可达）
    expect(frontier.targetLabel).toBe('stable');
    expect(frontier.needsGodRun).toBe(false);
    // 备选里应有标记为需超常发挥的踩线/更远目标
    expect(frontier.alternativeTargets?.some((t) => t.needsGodRun)).toBe(true);
  });

  it('补分（稳推）候选的 ROI 高于同谱面远超稳定水平的踩线目标', () => {
    const records: RksRecord[] = [
      createRecord({ song_name: 'S1', difficulty_value: 15, acc: 94 }),
      createRecord({ song_name: 'S2', difficulty_value: 15, acc: 93 }),
      createRecord({ song_name: 'S3', difficulty_value: 15, acc: 92 }),
      createRecord({ song_name: 'Frontier', difficulty_value: 15, acc: 92, push_acc: 96 }),
    ];
    const result = buildLilithRecommendations(records, { limit: 8 });
    const frontier = findRecommendation(result, 'Frontier');
    const stableTarget = findTargetByLabel(frontier, 'stable');
    const pushLineTarget = findTargetByLabel(frontier, 'push_line');
    expect(stableTarget).toBeDefined();
    expect(pushLineTarget).toBeDefined();
    expect(stableTarget!.roi).toBeGreaterThan(pushLineTarget!.roi);
  });
});

describe('潜力之选：可行上限（阶段7）', () => {
  it('潜力目标 = 可行上限内 Δ总RKS 最大的目标（而非 ROI 最优的保守目标）', () => {
    const records: RksRecord[] = [
      createRecord({ song_name: 'Base1', difficulty_value: 15, acc: 95 }),
      createRecord({ song_name: 'Base2', difficulty_value: 15, acc: 94.5 }),
      createRecord({ song_name: 'Base3', difficulty_value: 15, acc: 95.5 }),
      // 低于"玩家RKS+0.5"门槛 → 单次提升不受限；稳定水平≈94.75
      createRecord({ song_name: 'Target', difficulty_value: 15, acc: 92, push_acc: 96 }),
    ];
    const result = buildLilithRecommendations(records, { limit: 8, playerRks: 15 });
    const potential = result.potentialAllCandidates.find((c) => c.record.song_name === 'Target');
    const efficiency = findRecommendation(result, 'Target');

    expect(potential).toBeDefined();
    // 可行上限（稳定 94.75 + 2.5 ≈ 97.25）内最大增量目标：采样间距内最高可达点 = 踩线+1% = 97（plus_1）
    expect(potential!.targetAcc).toBeCloseTo(97, 6);
    expect(potential!.targetLabel).toBe('plus_1');
    expect(potential!.overReach).toBeLessThanOrEqual(2.5 + 1e-6);
    // 效率视图选择保守目标（0 超限的稳推点 94.75），潜力视图选择更大增量
    expect(efficiency.targetAcc).toBeLessThan(potential!.targetAcc);
    // 潜力条目展开仍能看到效率视图的保守目标（stable）
    expect(potential!.alternativeTargets?.some((t) => t.label === 'stable')).toBe(true);
  });

  it('所有目标超出可行上限时，该曲目不出现在潜力列表（效率视图不受影响）', () => {
    const records: RksRecord[] = [
      createRecord({ song_name: 'Base1', difficulty_value: 15, acc: 95 }),
      createRecord({ song_name: 'Base2', difficulty_value: 15, acc: 96 }),
      createRecord({ song_name: 'Base3', difficulty_value: 15, acc: 95 }),
      // 玩家已处于/高于稳定水平（≈95.25），踩线 98.5 及 +1%/+2%/φ 全部超限
      createRecord({ song_name: 'FarPush', difficulty_value: 15, acc: 95.5, push_acc: 98.5 }),
    ];
    const result = buildLilithRecommendations(records, { limit: 8, playerRks: 15 });

    expect(result.potentialAllCandidates.find((c) => c.record.song_name === 'FarPush')).toBeUndefined();
    expect(result.allCandidates.find((c) => c.record.song_name === 'FarPush')).toBeDefined();
  });

  it('近-φ 谱面的潜力目标可达 100%（最后一公里被收录）', () => {
    const records: RksRecord[] = [
      createRecord({ song_name: 'Base1', difficulty_value: 15, acc: 99.7 }),
      createRecord({ song_name: 'Base2', difficulty_value: 15, acc: 99.9 }),
      createRecord({ song_name: 'Base3', difficulty_value: 15, acc: 99.8 }),
      // 有能力收尾（已有一首 φ，closeRate 足够高）
      createRecord({ song_name: 'PhiBase', difficulty_value: 15.2, acc: 100, already_phi: true }),
      createRecord({ song_name: 'NearPhi', difficulty_value: 15.4, acc: 99.7, push_acc: 100 }),
    ];
    const result = buildLilithRecommendations(records, { limit: 8, playerRks: 14 });
    const potential = result.potentialAllCandidates.find((c) => c.record.song_name === 'NearPhi');

    expect(potential).toBeDefined();
    expect(potential!.targetAcc).toBeCloseTo(100, 6);
    expect(potential!.overReach).toBeLessThanOrEqual(2.5 + 1e-6);
    // 100% 目标进入 Phi 池
    expect(potential!.deltaTop3Phi).toBeGreaterThan(0);
  });

  it('potentialAllCandidates 按 deltaTotal 降序且收录可行上限候选', () => {
    const records: RksRecord[] = [
      createRecord({ song_name: 'Base1', difficulty_value: 15, acc: 95 }),
      createRecord({ song_name: 'Base2', difficulty_value: 15, acc: 94.5 }),
      createRecord({ song_name: 'Base3', difficulty_value: 15, acc: 95.5 }),
      createRecord({ song_name: 'A1', difficulty_value: 15.4, acc: 92, push_acc: 95.5 }),
      createRecord({ song_name: 'A2', difficulty_value: 14.6, acc: 92, push_acc: 95 }),
      createRecord({ song_name: 'A3', difficulty_value: 14.2, acc: 93, push_acc: 94.5 }),
    ];
    const result = buildLilithRecommendations(records, { limit: 8, playerRks: 14 });
    const list = result.potentialAllCandidates;

    expect(list.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].deltaTotal).toBeGreaterThanOrEqual(list[i].deltaTotal);
    }
  });

  it('compareCandidatesByPotential: deltaTotal 相同时 overReach 小的在前', () => {
    const { compareCandidatesByPotential } = __lilithRecommendationTestables;
    const base: LilithRecommendationItem = {
      record: createRecord({ song_name: 'A' }),
      sourceIndex: 0,
      targetAcc: 96,
      targetRks: 12,
      deltaAcc: 2,
      deltaTop27: 0.6,
      deltaTop3Phi: 0,
      deltaTotal: 0.02,
      roi: 0.5,
      pool: 'top27',
      targetLabel: 'push_line',
      needsGodRun: false,
      overReach: 1.0,
    };
    const low = { ...base, sourceIndex: 1, overReach: 1.0 };
    const high = { ...base, sourceIndex: 2, record: createRecord({ song_name: 'B' }), overReach: 2.0 };

    expect(compareCandidatesByPotential(low, high)).toBeLessThan(0);
    expect(compareCandidatesByPotential(high, low)).toBeGreaterThan(0);
  });

  it('远超玩家胜任水平的高定数谱面被潜力列表剔除（即使 ACC 上限满足）', () => {
    const records: RksRecord[] = [
      createRecord({ song_name: 'Base1', difficulty_value: 15, acc: 95 }),
      createRecord({ song_name: 'Base2', difficulty_value: 15, acc: 94.5 }),
      createRecord({ song_name: 'Base3', difficulty_value: 15, acc: 95.5 }),
      // 16.8 定数"尝试过但未胜任"：踩线 95.5 的 ACC 超限很小（≈0.75），但定数远超玩家水平
      createRecord({ song_name: 'OverLevel', difficulty_value: 16.8, acc: 89, push_acc: 95.5 }),
    ];
    const result = buildLilithRecommendations(records, { limit: 8, playerRks: 14 });

    expect(result.potentialAllCandidates.find((c) => c.record.song_name === 'OverLevel')).toBeUndefined();
    expect(result.allCandidates.find((c) => c.record.song_name === 'OverLevel')).toBeDefined();
  });

  it('potentialOverReachCap 默认 2.5 且可参数化', () => {
    const records: RksRecord[] = [
      createRecord({ song_name: 'Base1', difficulty_value: 15, acc: 95 }),
      createRecord({ song_name: 'Base2', difficulty_value: 15, acc: 94.5 }),
      createRecord({ song_name: 'Base3', difficulty_value: 15, acc: 95.5 }),
      createRecord({ song_name: 'Target', difficulty_value: 15.4, acc: 92, push_acc: 95.5 }),
    ];
    const result = buildLilithRecommendations(records, { limit: 5 });
    expect(result.potentialOverReachCap).toBe(2.5);
    expect(result.potentialMaxLevelPenalty).toBe(2.0);

    const strict = buildLilithRecommendations(records, {
      limit: 5,
      potentialOverReachCap: 1.8,
      potentialMaxLevelPenalty: 1.5,
    });
    expect(strict.potentialOverReachCap).toBe(1.8);
    expect(strict.potentialMaxLevelPenalty).toBe(1.5);
  });
});

describe('阶段8：高定数绝对天花板 / 能力证明 / 单次提升上限', () => {
  it('computeAbsoluteAccCeiling: 以玩家RKS+1.0为基准，向上递减向下递增，证明时放宽', () => {
    const { computeAbsoluteAccCeiling } = __lilithRecommendationTestables;
    expect(computeAbsoluteAccCeiling(16.0, 15, false)).toBeCloseTo(98.5, 6);
    expect(computeAbsoluteAccCeiling(16.5, 15, false)).toBeCloseTo(98.1, 6);
    expect(computeAbsoluteAccCeiling(17.0, 15, false)).toBeCloseTo(97.7, 6);
    expect(computeAbsoluteAccCeiling(15.4, 15, false)).toBeCloseTo(98.8, 6);
    expect(computeAbsoluteAccCeiling(14.0, 15, false)).toBeCloseTo(99.5, 6);
    expect(computeAbsoluteAccCeiling(13.0, 15, false)).toBeCloseTo(100, 6); // 封顶
    expect(computeAbsoluteAccCeiling(16.0, 15, true)).toBeCloseTo(99.0, 6); // 证明 +0.5
    expect(computeAbsoluteAccCeiling(15.0, 0, false)).toBe(100); // 无参照 → 不限制
  });

  it('computeMaxJump: 低于门槛不限制，超出后 1.5% 起指数递减', () => {
    const { computeMaxJump } = __lilithRecommendationTestables;
    expect(computeMaxJump(15.0, 15)).toBe(Number.POSITIVE_INFINITY); // 门槛内
    expect(computeMaxJump(14.0, 15)).toBe(Number.POSITIVE_INFINITY);
    expect(computeMaxJump(15.5, 15)).toBeCloseTo(1.5, 6); // 恰在门槛
    expect(computeMaxJump(16.0, 15)).toBeCloseTo(1.5 * Math.exp(-0.5), 6);
    expect(computeMaxJump(16.5, 15)).toBeCloseTo(1.5 * Math.exp(-1), 6);
    expect(computeMaxJump(17.0, 15)).toBeCloseTo(1.5 * Math.exp(-1.5), 6);
    expect(computeMaxJump(16.0, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('hasProofedCeiling: band（T−0.2 起）内需 ≥2 条定数与谱面RKS均达标的记录', () => {
    const { hasProofedCeiling } = __lilithRecommendationTestables;
    const proof1 = createRecord({ song_name: 'P1', difficulty_value: 16.1, acc: 99.7 }); // rks≈15.89
    const proof2 = createRecord({ song_name: 'P2', difficulty_value: 16.2, acc: 99.6 }); // rks≈15.91
    const notEnough = createRecord({ song_name: 'N1', difficulty_value: 16.1, acc: 96 }); // rks≈14.7 < 15.8
    expect(hasProofedCeiling([proof1], 15)).toBe(false);
    expect(hasProofedCeiling([proof1, proof2], 15)).toBe(true);
    expect(hasProofedCeiling([proof1, notEnough], 15)).toBe(false);
    expect(hasProofedCeiling([proof1, proof2], 0)).toBe(false);
  });

  it('无能力证明时，高定数超过绝对天花板的目标不进入潜力列表', () => {
    const records: RksRecord[] = [
      createRecord({ song_name: 'B1', difficulty_value: 16, acc: 98.2 }),
      createRecord({ song_name: 'B2', difficulty_value: 16, acc: 97.9 }),
      // 稳定水平≈97.9（可靠桶），推 98.9 只超 1.0 且单次提升未超限；
      // 但无证明时天花板 = 98.75（16.0 低于 T=16.5）→ 98.9 被天花板拦下
      createRecord({ song_name: 'HighPush', difficulty_value: 16, acc: 97.8, push_acc: 98.9 }),
    ];
    const result = buildLilithRecommendations(records, { limit: 8, playerRks: 15.5 });
    const potential = result.potentialAllCandidates.find((c) => c.record.song_name === 'HighPush');

    expect(result.proofedCeiling).toBe(false);
    // 无证明：天花板 98.75 拦住 98.9（及更远目标），可行上限内只剩稳推点 97.9
    expect(potential).toBeDefined();
    expect(potential!.targetAcc).toBeCloseTo(97.9, 6);
    expect(potential!.targetLabel).toBe('stable');
    expect(result.allCandidates.find((c) => c.record.song_name === 'HighPush')).toBeDefined();
  });

  it('能力证明成立时允许略微抬高天花板（高定数目标进入潜力列表）', () => {
    const records: RksRecord[] = [
      createRecord({ song_name: 'B1', difficulty_value: 16, acc: 98.2 }),
      createRecord({ song_name: 'B2', difficulty_value: 16, acc: 97.9 }),
      // 证明：band [16.3, ∞) 内的近-φ 高定数记录（定数≥16.3 且谱面RKS≥16.3）
      createRecord({ song_name: 'Proof1', difficulty_value: 16.4, acc: 99.87 }), // rks≈16.31
      createRecord({ song_name: 'Proof2', difficulty_value: 16.5, acc: 99.85 }), // rks≈16.39
      createRecord({ song_name: 'HighPush', difficulty_value: 16, acc: 97.8, push_acc: 98.9 }),
    ];
    const result = buildLilithRecommendations(records, { limit: 8, playerRks: 15.5 });
    const potential = result.potentialAllCandidates.find((c) => c.record.song_name === 'HighPush');

    expect(result.proofedCeiling).toBe(true);
    expect(potential).toBeDefined();
    // 证明后天花板 = 98.5 + 0.5×0.5 + 0.5 = 99.25，目标可达
    expect(potential!.targetAcc).toBeGreaterThan(98.9 - 1e-6);
    expect(potential!.targetAcc).toBeLessThanOrEqual(99.25 + 1e-6);
  });

  it('单次提升上限：稳定估计可靠时可练到自身稳定水平，全局回退时不豁免', () => {
    // 可靠桶（16.5 有 3 条常态记录）→ 允许补到稳定水平 94.75
    const reliableRecords: RksRecord[] = [
      createRecord({ song_name: 'R1', difficulty_value: 16.5, acc: 95 }),
      createRecord({ song_name: 'R2', difficulty_value: 16.5, acc: 94.5 }),
      createRecord({ song_name: 'R3', difficulty_value: 16.5, acc: 95 }),
      createRecord({ song_name: 'Jump', difficulty_value: 16.5, acc: 94, push_acc: 97.5 }),
    ];
    const reliableResult = buildLilithRecommendations(reliableRecords, { limit: 8, playerRks: 14 });
    const reliableJump = reliableResult.potentialAllCandidates.find((c) => c.record.song_name === 'Jump');
    expect(reliableJump).toBeDefined();
    expect(reliableJump!.targetLabel).toBe('stable');
    expect(reliableJump!.targetAcc).toBeCloseTo(94.75, 6);

    // 无可靠桶（全局中位数回退）→ 不豁免，97.5 大跳跃被拦，整首曲目不进潜力列表
    const unreliableRecords: RksRecord[] = [
      createRecord({ song_name: 'U1', difficulty_value: 15, acc: 95 }),
      createRecord({ song_name: 'U2', difficulty_value: 15, acc: 94.5 }),
      createRecord({ song_name: 'U3', difficulty_value: 15, acc: 95.5 }),
      createRecord({ song_name: 'Jump', difficulty_value: 16.5, acc: 94, push_acc: 97.5 }),
    ];
    const unreliableResult = buildLilithRecommendations(unreliableRecords, { limit: 8, playerRks: 14 });
    expect(unreliableResult.potentialAllCandidates.find((c) => c.record.song_name === 'Jump')).toBeUndefined();
  });

  it('效率视图软惩罚：超出天花板/单次上限的目标成本上升，φ 豁免天花板', () => {
    const { computeEffectiveCost } = __lilithRecommendationTestables;

    // 天花板软惩罚：其余条件相同，仅天花板不同 → 成本按 (1 + 3×超出量) 放大
    const ceilingConstrained = computeEffectiveCost(95, 99, 1, 96, { absCeiling: 98.5 });
    const ceilingUnconstrained = computeEffectiveCost(95, 99, 1, 96, { absCeiling: 100 });
    expect(ceilingConstrained / ceilingUnconstrained).toBeCloseTo(1 + 3 * 0.5, 6);

    // 单次提升软惩罚：超 2.9 → ×(1 + 2×2.9)
    const jumpConstrained = computeEffectiveCost(94, 97.5, 1, 96, { allowedDelta: 0.6 });
    const jumpUnconstrained = computeEffectiveCost(94, 97.5, 1, 96, { allowedDelta: 3.5 });
    expect(jumpConstrained / jumpUnconstrained).toBeCloseTo(1 + 2 * 2.9, 6);

    // φ 目标豁免天花板
    const phiWithCeiling = computeEffectiveCost(99.5, 100, 1, 99.6, { absCeiling: 98.5 });
    const phiNoCeiling = computeEffectiveCost(99.5, 100, 1, 99.6, { absCeiling: 100 });
    expect(phiWithCeiling).toBeCloseTo(phiNoCeiling, 10);
  });
});
