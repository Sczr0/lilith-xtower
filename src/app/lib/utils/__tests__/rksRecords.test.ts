import { describe, expect, it } from 'vitest';
import { filterSortLimitRksRecords } from '../rksRecords';
import type { RksRecord } from '../../types/score';

const sampleRecords: RksRecord[] = [
  { song_name: 'Alpha', difficulty: 'IN', difficulty_value: 12.3, acc: 98.5, score: 990000, rks: 11.1 },
  { song_name: 'Beta', difficulty: 'AT', difficulty_value: 15.0, acc: 90.0, score: 950000, rks: 12.0 },
  { song_name: 'Gamma', difficulty: 'EZ', difficulty_value: 5.0, acc: 65.0, score: 500000, rks: 0.0 },
  { song_name: 'Delta', difficulty: 'HD', difficulty_value: 10.0, acc: 97.0, score: 980000, rks: 10.5 },
];

describe('filterSortLimitRksRecords', () => {
  it('filters by keyword (case-insensitive)', () => {
    const { records, totalMatched } = filterSortLimitRksRecords(sampleRecords, { searchQuery: 'alp' });
    expect(totalMatched).toBe(1);
    expect(records.map((r) => r.song_name)).toEqual(['Alpha']);
  });

  it('filters by difficulty', () => {
    const { records, totalMatched } = filterSortLimitRksRecords(sampleRecords, { difficulty: 'AT' });
    expect(totalMatched).toBe(1);
    expect(records[0]?.song_name).toBe('Beta');
  });

  it('supports numeric ranges and swaps invalid min/max', () => {
    const res = filterSortLimitRksRecords(sampleRecords, {
      accRange: { min: 99, max: 95 },
      sortBy: 'acc',
      sortOrder: 'desc',
    });

    expect(res.totalMatched).toBe(2);
    expect(res.records.map((r) => r.song_name)).toEqual(['Alpha', 'Delta']);
  });

  it('filters by rksRange and onlyPositiveRks', () => {
    const res = filterSortLimitRksRecords(sampleRecords, {
      rksRange: { min: 10.6, max: 12.1 },
      onlyPositiveRks: true,
      sortBy: 'rks',
      sortOrder: 'desc',
    });

    expect(res.totalMatched).toBe(2);
    expect(res.records.map((r) => r.song_name)).toEqual(['Beta', 'Alpha']);
  });

  it('applies limit after filtering and keeps totalMatched unchanged', () => {
    const res = filterSortLimitRksRecords(sampleRecords, {
      onlyPositiveRks: true,
      sortBy: 'score',
      sortOrder: 'desc',
      limit: 2,
    });

    expect(res.totalMatched).toBe(3);
    expect(res.records).toHaveLength(2);
    expect(res.records.map((r) => r.song_name)).toEqual(['Alpha', 'Delta']);
  });
});

