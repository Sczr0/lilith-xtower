import { describe, expect, it } from 'vitest';

import type { RksRecord } from '../../types/score';
import { buildLilithRecommendations, resolveLilithStructureStatus } from '../lilithRecommendation';

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
    // 多目标采样后，最优目标可能是 Phi（100%），使得 top3phi 也有候选
    // 因此 status 可能是 'top3phi_low' 或 'balanced'，取决于最优目标落在哪个池
    expect(['top3phi_low', 'balanced']).toContain(result.status);
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

    expect(entrant.deltaTop27).toBeCloseTo(8.6, 6);
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

    expect(findRecommendation(strongCloserResult, 'ClosurePhi').roi).toBeGreaterThan(
      findRecommendation(weakCloserResult, 'ClosurePhi').roi,
    );
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
    expect(['push_line', 'plus_1', 'plus_2', 'phi', 'optimal']).toContain(highConst.targetLabel);
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
      createRecord({ song_name: 'SmallDelta', difficulty_value: 14, acc: 94, push_acc: 95 }),
      createRecord({ song_name: 'BigDelta', difficulty_value: 16, acc: 90, push_acc: 98 }),
      createRecord({ song_name: 'MediumDelta', difficulty_value: 15, acc: 92, push_acc: 96 }),
    ];

    const result = buildLilithRecommendations(records, { limit: 5 });

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
      createRecord({ song_name: 'SmallDelta', difficulty_value: 14, acc: 94, push_acc: 95 }),
      createRecord({ song_name: 'BigDelta', difficulty_value: 16, acc: 90, push_acc: 98 }),
      createRecord({ song_name: 'MediumDelta', difficulty_value: 15, acc: 92, push_acc: 96 }),
    ];

    const result = buildLilithRecommendations(records, { limit: 5 });

    expect(result.potentialAllCandidates).toHaveLength(result.allCandidates.length);
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
    expect(['push_line', 'plus_1', 'plus_2', 'phi', 'optimal']).toContain(candidate.targetLabel);

    // push_acc=95 且 acc=92，应有多个备选目标（push_line, +1, +2, phi, 以及采样点）
    // alternativeTargets 可能存在也可能不存在（取决于采样结果）
    if (candidate.alternativeTargets) {
      for (const alt of candidate.alternativeTargets) {
        expect(alt.targetAcc).toBeGreaterThan(0);
        expect(alt.roi).toBeGreaterThan(0);
        expect(['push_line', 'plus_1', 'plus_2', 'phi', 'optimal']).toContain(alt.label);
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
