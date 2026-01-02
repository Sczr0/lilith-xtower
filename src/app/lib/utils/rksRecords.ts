import type { RksRecord } from '../types/score';

export type RksSortBy = 'rks' | 'acc' | 'difficulty_value' | 'score';
export type RksSortOrder = 'asc' | 'desc';
export type RksDifficultyFilter = 'all' | RksRecord['difficulty'];

export type NumericRange = {
  min?: number | null;
  max?: number | null;
};

export type RksRecordsFilterOptions = {
  searchQuery?: string;
  difficulty?: RksDifficultyFilter;
  onlyPositiveRks?: boolean;

  rksRange?: NumericRange;
  accRange?: NumericRange;
  difficultyValueRange?: NumericRange;
  scoreRange?: NumericRange;

  sortBy?: RksSortBy;
  sortOrder?: RksSortOrder;

  limit?: number | null;
};

export type FilterSortLimitResult = {
  records: RksRecord[];
  totalMatched: number;
};

function normalizeRange(range?: NumericRange): Required<NumericRange> {
  const min = typeof range?.min === 'number' && Number.isFinite(range.min) ? range.min : null;
  const max = typeof range?.max === 'number' && Number.isFinite(range.max) ? range.max : null;

  if (min !== null && max !== null && min > max) {
    return { min: max, max: min };
  }

  return { min, max };
}

export function filterSortLimitRksRecords(
  records: RksRecord[],
  options: RksRecordsFilterOptions,
): FilterSortLimitResult {
  const q = options.searchQuery?.trim().toLowerCase() ?? '';
  const difficulty = options.difficulty ?? 'all';
  const onlyPositiveRks = options.onlyPositiveRks ?? false;

  const rksRange = normalizeRange(options.rksRange);
  const accRange = normalizeRange(options.accRange);
  const difficultyValueRange = normalizeRange(options.difficultyValueRange);
  const scoreRange = normalizeRange(options.scoreRange);

  const filtered = records.filter((record) => {
    if (difficulty !== 'all' && record.difficulty !== difficulty) return false;
    if (q && !record.song_name.toLowerCase().includes(q)) return false;
    if (onlyPositiveRks && record.rks <= 0) return false;

    if (rksRange.min !== null && record.rks < rksRange.min) return false;
    if (rksRange.max !== null && record.rks > rksRange.max) return false;

    if (accRange.min !== null && record.acc < accRange.min) return false;
    if (accRange.max !== null && record.acc > accRange.max) return false;

    if (difficultyValueRange.min !== null && record.difficulty_value < difficultyValueRange.min) return false;
    if (difficultyValueRange.max !== null && record.difficulty_value > difficultyValueRange.max) return false;

    if (scoreRange.min !== null && record.score < scoreRange.min) return false;
    if (scoreRange.max !== null && record.score > scoreRange.max) return false;

    return true;
  });

  const totalMatched = filtered.length;

  const sortBy = options.sortBy ?? 'rks';
  const sortOrder = options.sortOrder ?? 'desc';

  const sorted = [...filtered].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'rks') {
      comparison = b.rks - a.rks;
    } else if (sortBy === 'acc') {
      comparison = b.acc - a.acc;
    } else if (sortBy === 'difficulty_value') {
      comparison = b.difficulty_value - a.difficulty_value;
    } else if (sortBy === 'score') {
      comparison = b.score - a.score;
    }

    if (comparison !== 0) {
      return sortOrder === 'desc' ? comparison : -comparison;
    }

    // 兜底：避免不同运行时下排序不稳定导致 UI 抖动
    return a.song_name.localeCompare(b.song_name);
  });

  const limitRaw = options.limit;
  const limit = typeof limitRaw === 'number' && Number.isFinite(limitRaw) ? Math.max(0, Math.floor(limitRaw)) : 0;
  const limited = limit > 0 ? sorted.slice(0, limit) : sorted;

  return { records: limited, totalMatched };
}

