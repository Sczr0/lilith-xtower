import { describe, expect, it } from 'vitest';
import { attachRksPushAcc } from '../rksPush';
import type { RksRecord } from '../../types/score';

const accForRks = (targetRks: number, constant: number) => 55 + 45 * Math.sqrt(targetRks / constant);

function findBySong(records: RksRecord[], song: string) {
  const record = records.find((r) => r.song_name === song);
  if (!record) throw new Error(`record not found: ${song}`);
  return record;
}

describe('attachRksPushAcc', () => {
  it('computes push_acc and status flags against Best27 push line', () => {
    const baseline: RksRecord[] = [];
    const constant = 16;

    // 26 条 > 12 的记录 + 1 条 = 12，确保 Best27 推分线为 12.0
    for (let i = 0; i < 26; i++) {
      const rks = 12.1 + i * 0.1; // 12.1..14.6
      baseline.push({
        song_name: `Base_${i}`,
        difficulty: 'IN',
        difficulty_value: constant,
        acc: accForRks(rks, constant),
        score: 1000000,
        rks,
      });
    }
    baseline.push({
      song_name: 'Base_Line',
      difficulty: 'IN',
      difficulty_value: constant,
      acc: accForRks(12.0, constant),
      score: 1000000,
      rks: 12.0,
    });

    const extra: RksRecord[] = [
      // constant < 推分线：不可推分
      { song_name: 'Unreachable', difficulty: 'IN', difficulty_value: 11, acc: 99.99, score: 999999, rks: 11.0 },
      // constant == 推分线：需 Phi
      { song_name: 'PhiOnly', difficulty: 'IN', difficulty_value: 12, acc: 99.0, score: 999999, rks: 11.5 },
      // constant > 推分线：推分ACC为数值
      { song_name: 'Pushable', difficulty: 'IN', difficulty_value: 15, acc: 95.0, score: 999999, rks: 11.5 },
      // 已满 ACC：优先展示已满ACC（即使 constant < 推分线）
      { song_name: 'AlreadyPhi', difficulty: 'IN', difficulty_value: 11, acc: 100.0, score: 1000000, rks: 11.0 },
    ];

    const res = attachRksPushAcc([...baseline, ...extra], { pushLineRank: 27 });

    expect(res.pushLineRank).toBe(27);
    expect(res.pushLineRks).toBeCloseTo(12.0, 8);

    const unreachable = findBySong(res.records, 'Unreachable');
    expect(unreachable.unreachable).toBe(true);
    expect(unreachable.phi_only).toBe(false);
    expect(unreachable.already_phi).toBe(false);
    expect(unreachable.push_acc).toBeNull();

    const phiOnly = findBySong(res.records, 'PhiOnly');
    expect(phiOnly.unreachable).toBe(false);
    expect(phiOnly.phi_only).toBe(true);
    expect(phiOnly.already_phi).toBe(false);
    expect(phiOnly.push_acc).toBe(100);

    const pushable = findBySong(res.records, 'Pushable');
    expect(pushable.unreachable).toBe(false);
    expect(pushable.phi_only).toBe(false);
    expect(pushable.already_phi).toBe(false);
    expect(typeof pushable.push_acc).toBe('number');
    expect(pushable.push_acc as number).toBeGreaterThan(90);
    expect(pushable.push_acc as number).toBeLessThan(100);

    const alreadyPhi = findBySong(res.records, 'AlreadyPhi');
    expect(alreadyPhi.unreachable).toBe(false);
    expect(alreadyPhi.phi_only).toBe(false);
    expect(alreadyPhi.already_phi).toBe(true);
    expect(alreadyPhi.push_acc).toBeNull();

    // 已在推分线以上的谱面不应给出 push_acc
    const inBest27 = findBySong(res.records, 'Base_Line');
    expect(inBest27.rks).toBeCloseTo(12.0, 8);
    expect(inBest27.push_acc).toBeNull();
    expect(inBest27.unreachable).toBe(false);
    expect(inBest27.phi_only).toBe(false);
    expect(inBest27.already_phi).toBe(false);
  });
});

