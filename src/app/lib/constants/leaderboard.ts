// 说明：RKS 榜单（TOP）单次加载数量的默认值与可选项。
// - 默认值用于页面初次加载、预取等场景
// - 可选项用于 UI 下拉选择（避免无限制拉取导致渲染卡顿）

export const LEADERBOARD_TOP_LIMIT_OPTIONS = [20, 50, 100, 200] as const;

export type LeaderboardTopLimit = (typeof LEADERBOARD_TOP_LIMIT_OPTIONS)[number];

export const LEADERBOARD_TOP_LIMIT_DEFAULT: LeaderboardTopLimit = 100;

const isValidLeaderboardTopLimit = (value: number): value is LeaderboardTopLimit =>
  (LEADERBOARD_TOP_LIMIT_OPTIONS as readonly number[]).includes(value);

// 说明：用于从 localStorage / query / 非可信输入中恢复榜单分页大小，避免异常值导致一次性拉取过多。
export const normalizeLeaderboardTopLimit = (value: unknown): LeaderboardTopLimit => {
  const parsed = typeof value === 'number' ? value : Number(String(value));
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return LEADERBOARD_TOP_LIMIT_DEFAULT;
  }
  if (isValidLeaderboardTopLimit(parsed)) return parsed;
  return LEADERBOARD_TOP_LIMIT_DEFAULT;
};

