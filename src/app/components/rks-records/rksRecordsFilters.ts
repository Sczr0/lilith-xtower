import type { RksRecord } from '../../lib/types/score';
import { parseFiniteNumber } from '../../lib/utils/number';

export type ParsedFilterNumber = {
  value: number | null;
  error: string | null;
};

export function parseFilterNumber(
  raw: string,
  options?: { integer?: boolean; min?: number; max?: number }
): ParsedFilterNumber {
  const text = raw.trim();
  if (!text) return { value: null, error: null };

  // 兼容用户粘贴带千分位分隔符的数字（如 10,000）
  const normalized = text.replace(/,/g, '');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return { value: null, error: '请输入有效数字' };

  if (options?.integer && !Number.isInteger(parsed)) {
    return { value: parsed, error: '请输入整数' };
  }

  if (typeof options?.min === 'number' && Number.isFinite(options.min) && parsed < options.min) {
    return { value: parsed, error: `不能小于 ${options.min}` };
  }

  if (typeof options?.max === 'number' && Number.isFinite(options.max) && parsed > options.max) {
    return { value: parsed, error: `不能大于 ${options.max}` };
  }

  return { value: parsed, error: null };
}

export type RksFiltersSnapshot = {
  searchQuery: string;
  filterDifficulty: 'all' | 'EZ' | 'HD' | 'IN' | 'AT';
  sortBy: 'rks' | 'acc' | 'difficulty_value' | 'score';
  sortOrder: 'asc' | 'desc';
  minRks: string;
  maxRks: string;
  minAcc: string;
  maxAcc: string;
  minDifficultyValue: string;
  maxDifficultyValue: string;
  minScore: string;
  maxScore: string;
  onlyPositiveRks: boolean;
  limitCount: string;
};

export const sanitizeCachedRksFilters = (raw: unknown): RksFiltersSnapshot | null => {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as Record<string, unknown>;

  const filterDifficulty = entry.filterDifficulty;
  const sortBy = entry.sortBy;
  const sortOrder = entry.sortOrder;

  const isDifficultyFilter = (value: unknown): value is RksFiltersSnapshot['filterDifficulty'] =>
    value === 'all' || value === 'EZ' || value === 'HD' || value === 'IN' || value === 'AT';
  const isSortBy = (value: unknown): value is RksFiltersSnapshot['sortBy'] =>
    value === 'rks' || value === 'acc' || value === 'difficulty_value' || value === 'score';
  const isSortOrder = (value: unknown): value is RksFiltersSnapshot['sortOrder'] =>
    value === 'asc' || value === 'desc';

  return {
    searchQuery: typeof entry.searchQuery === 'string' ? entry.searchQuery : '',
    filterDifficulty: isDifficultyFilter(filterDifficulty) ? filterDifficulty : 'all',
    sortBy: isSortBy(sortBy) ? sortBy : 'rks',
    sortOrder: isSortOrder(sortOrder) ? sortOrder : 'desc',

    minRks: typeof entry.minRks === 'string' ? entry.minRks : '',
    maxRks: typeof entry.maxRks === 'string' ? entry.maxRks : '',
    minAcc: typeof entry.minAcc === 'string' ? entry.minAcc : '',
    maxAcc: typeof entry.maxAcc === 'string' ? entry.maxAcc : '',
    minDifficultyValue: typeof entry.minDifficultyValue === 'string' ? entry.minDifficultyValue : '',
    maxDifficultyValue: typeof entry.maxDifficultyValue === 'string' ? entry.maxDifficultyValue : '',
    minScore: typeof entry.minScore === 'string' ? entry.minScore : '',
    maxScore: typeof entry.maxScore === 'string' ? entry.maxScore : '',
    onlyPositiveRks: entry.onlyPositiveRks === true,
    limitCount: typeof entry.limitCount === 'string' ? entry.limitCount : '',
  };
};

// 读取 localStorage 缓存时做轻量校验，避免旧结构/污染数据导致渲染阶段崩溃
export const sanitizeCachedRksRecords = (raw: unknown): RksRecord[] | null => {
  if (!Array.isArray(raw)) return null;
  const records: RksRecord[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;

    const song_name = typeof entry.song_name === 'string' ? entry.song_name : null;
    const difficulty = entry.difficulty;
    if (!song_name) continue;
    if (difficulty !== 'EZ' && difficulty !== 'HD' && difficulty !== 'IN' && difficulty !== 'AT') continue;

    const difficulty_value = parseFiniteNumber(entry.difficulty_value);
    const acc = parseFiniteNumber(entry.acc);
    const score = parseFiniteNumber(entry.score);
    const rks = parseFiniteNumber(entry.rks);
    const push_acc = parseFiniteNumber(entry.push_acc);
    const unreachable = entry.unreachable === true;
    const phi_only = entry.phi_only === true;
    const already_phi = entry.already_phi === true;

    if (difficulty_value === null || acc === null || score === null || rks === null) continue;

    records.push({
      song_name,
      difficulty,
      difficulty_value,
      acc,
      score,
      rks,
      push_acc,
      unreachable,
      phi_only,
      already_phi,
    });
  }

  return records;
};
