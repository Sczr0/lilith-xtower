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
    expect(result.recommendations[0].deltaAcc).toBeCloseTo(5, 8);
    expect(result.recommendations[0].deltaTotal).toBeGreaterThan(0);
    expect(result.status).toBe('top3phi_low');
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
});

