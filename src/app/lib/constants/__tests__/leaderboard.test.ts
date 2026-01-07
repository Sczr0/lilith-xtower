import { describe, expect, it } from 'vitest';
import { LEADERBOARD_TOP_LIMIT_DEFAULT, normalizeLeaderboardTopLimit } from '../leaderboard';

describe('normalizeLeaderboardTopLimit', () => {
  it('falls back to default for invalid values', () => {
    expect(normalizeLeaderboardTopLimit(undefined)).toBe(LEADERBOARD_TOP_LIMIT_DEFAULT);
    expect(normalizeLeaderboardTopLimit(null)).toBe(LEADERBOARD_TOP_LIMIT_DEFAULT);
    expect(normalizeLeaderboardTopLimit('')).toBe(LEADERBOARD_TOP_LIMIT_DEFAULT);
    expect(normalizeLeaderboardTopLimit('999')).toBe(LEADERBOARD_TOP_LIMIT_DEFAULT);
    expect(normalizeLeaderboardTopLimit(999)).toBe(LEADERBOARD_TOP_LIMIT_DEFAULT);
    expect(normalizeLeaderboardTopLimit('100.5')).toBe(LEADERBOARD_TOP_LIMIT_DEFAULT);
  });

  it('accepts supported page size options', () => {
    expect(normalizeLeaderboardTopLimit(20)).toBe(20);
    expect(normalizeLeaderboardTopLimit('50')).toBe(50);
    expect(normalizeLeaderboardTopLimit(100)).toBe(100);
    expect(normalizeLeaderboardTopLimit('200')).toBe(200);
  });
});

