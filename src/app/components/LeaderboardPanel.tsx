'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LeaderboardAPI } from '../lib/api/leaderboard';
import type {
  LeaderboardMeResponse,
  LeaderboardTopItem,
  PublicProfileResponse,
} from '../lib/types/leaderboard';

const TOP_PAGE_SIZE = 20;

const formatDateTime = (value: string) => {
  try {
    return new Date(value).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
};

const formatPercent = (value: number) => `${value.toFixed(2)}%`;

const buttonStyles = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300 disabled:cursor-not-allowed disabled:bg-blue-300 dark:hover:bg-blue-500',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white/80 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors duration-150 hover:border-gray-400 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-gray-200 dark:hover:border-neutral-600 dark:hover:text-gray-50',
  ghost:
    'inline-flex items-center justify-center gap-1 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-400 dark:text-gray-300 dark:hover:text-gray-50',
};

const renderRankBadge = (rank: number) => {
  const base =
    'inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold';
  if (rank === 1) {
    return (
      <span className={`${base} border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-200`}>
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className={`${base} border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/50 dark:bg-slate-500/15 dark:text-slate-200`}>
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className={`${base} border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/50 dark:bg-orange-500/15 dark:text-orange-200`}>
        3
      </span>
    );
  }
  return (
    <span className={`${base} border-gray-200 bg-white text-gray-600 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-gray-300`}>
      #{rank}
    </span>
  );
};

const renderChartItems = (items: PublicProfileResponse['ap_top3']) => {
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white/60 px-4 py-6 text-sm text-gray-500 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-gray-400">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 17v-6m6 6V5M5 21h14M13 13l2-2m0 0l2 2m-2-2v8"
          />
        </svg>
        <span>暂无数据</span>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={`${item.song}-${item.difficulty}-${index}`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/70 px-4 py-3 text-sm transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-neutral-700 dark:bg-neutral-900/50 dark:hover:border-blue-700/60 dark:hover:text-blue-200"
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
              #{index + 1}
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{item.song}</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                item.difficulty === 'EZ'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : item.difficulty === 'HD'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : item.difficulty === 'IN'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
              }`}
            >
              {item.difficulty}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              {item.acc.toFixed(2)}%
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              {item.rks.toFixed(4)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
};

export function LeaderboardPanel() {
  const { credential } = useAuth();

  const [topItems, setTopItems] = useState<LeaderboardTopItem[]>([]);
  const [topTotal, setTopTotal] = useState<number | null>(null);
  const [isTopLoading, setIsTopLoading] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const topOffsetRef = useRef(0);

  const [myRank, setMyRank] = useState<LeaderboardMeResponse | null>(null);
  const [isMyRankLoading, setIsMyRankLoading] = useState(false);
  const [myRankError, setMyRankError] = useState<string | null>(null);

  const [aliasInput, setAliasInput] = useState('');
  const [isAliasUpdating, setIsAliasUpdating] = useState(false);
  const [aliasMessage, setAliasMessage] = useState<string | null>(null);
  const [aliasError, setAliasError] = useState<string | null>(null);

  const [isProfilePublic, setIsProfilePublic] = useState(true);
  const [showBestTop3, setShowBestTop3] = useState(true);
  const [showApTop3, setShowApTop3] = useState(true);
  const [showRksComposition, setShowRksComposition] = useState(true);
  const [isProfileUpdating, setIsProfileUpdating] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [lookupAlias, setLookupAlias] = useState('');
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfileResponse | null>(null);

  const loadTop = useCallback(async (reset = false) => {
    setIsTopLoading(true);
    setTopError(null);
    try {
      const offset = reset ? 0 : topOffsetRef.current;
      const data = await LeaderboardAPI.getTop({
        limit: TOP_PAGE_SIZE,
        offset,
      });

      // 按 RKS 分数降序排序
      const sortedItems = data.items.sort((a, b) => b.score - a.score);

      // 为排序后的数据重新分配排名
      const itemsWithRanks = sortedItems.map((item, index) => ({
        ...item,
        rank: offset + index + 1, // 根据偏移量和索引重新计算排名
      }));

      setTopTotal(data.total);
      setTopItems((prev) => (reset ? itemsWithRanks : [...prev, ...itemsWithRanks]));
      topOffsetRef.current = offset + itemsWithRanks.length;
    } catch (error) {
      setTopError(error instanceof Error ? error.message : '加载榜单失败');
    } finally {
      setIsTopLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTop(true).catch(() => {});
  }, [loadTop]);

  const handleRefreshTop = () => {
    loadTop(true).catch(() => {});
  };

  const handleLoadMore = () => {
    loadTop(false).catch(() => {});
  };

  const handleFetchMyRank = async () => {
    if (!credential) {
      setMyRankError('请先登录后再查询排名');
      return;
    }

    setIsMyRankLoading(true);
    setMyRankError(null);
    try {
      const data = await LeaderboardAPI.getMyRanking(credential);
      setMyRank(data);
    } catch (error) {
      setMyRank(null);
      setMyRankError(error instanceof Error ? error.message : '查询失败');
    } finally {
      setIsMyRankLoading(false);
    }
  };

  const handleAliasUpdate = async () => {
    if (!credential) {
      setAliasError('请先登录后再绑定别名');
      return;
    }

    setAliasError(null);
    setAliasMessage(null);
    setIsAliasUpdating(true);
    try {
      await LeaderboardAPI.updateAlias(credential, { alias: aliasInput });
      setAliasMessage('别名更新成功');
    } catch (error) {
      setAliasMessage(null);
      setAliasError(error instanceof Error ? error.message : '更新失败');
    } finally {
      setIsAliasUpdating(false);
    }
  };

  const handleProfileUpdate = async () => {
    if (!credential) {
      setProfileError('请先登录后再调整公开设置');
      return;
    }

    setProfileError(null);
    setProfileMessage(null);
    setIsProfileUpdating(true);
    try {
      await LeaderboardAPI.updateProfileSettings(credential, {
        is_public: isProfilePublic,
        show_best_top3: showBestTop3,
        show_ap_top3: showApTop3,
        show_rks_composition: showRksComposition,
      });
      setProfileMessage('公开设置已更新');
    } catch (error) {
      setProfileMessage(null);
      setProfileError(error instanceof Error ? error.message : '更新失败');
    } finally {
      setIsProfileUpdating(false);
    }
  };

  const handleLookupProfile = async () => {
    setLookupError(null);
    setIsLookupLoading(true);
    try {
      const data = await LeaderboardAPI.getPublicProfile(lookupAlias);
      setPublicProfile(data);
    } catch (error) {
      setPublicProfile(null);
      setLookupError(error instanceof Error ? error.message : '查询失败');
    } finally {
      setIsLookupLoading(false);
    }
  };

  const canLoadMore = useMemo(() => {
    if (topTotal === null) return false;
    return topItems.length < topTotal;
  }, [topItems.length, topTotal]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm shadow-gray-100/40 backdrop-blur-sm transition-colors dark:border-neutral-800 dark:bg-neutral-900/50 dark:shadow-none">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 sm:text-xl">
              RKS 榜单
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              参考全站最新同步的玩家成绩，数据每次操作实时刷新
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRefreshTop}
              disabled={isTopLoading}
              className={buttonStyles.secondary}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 4v5h.582m15.356 2a8.001 8.001 0 00-15.356-2m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              刷新榜单
            </button>
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={!canLoadMore || isTopLoading}
              className={buttonStyles.primary}
            >
              {isTopLoading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" role="img">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
                    />
                  </svg>
                  同步中…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  加载更多
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>
            已加载 {topItems.length.toLocaleString()}
            {topTotal !== null ? ` / ${topTotal.toLocaleString()}` : ''} 名玩家
          </span>
          {topError ? null : isTopLoading ? (
            <span>正在获取最新数据…</span>
          ) : (
            <span>榜单按 RKS 分数降序排列</span>
          )}
        </div>

        {topError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
            {topError}
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <tr className="border-b border-gray-200/70 dark:border-neutral-800/70">
                <th className="px-4 py-3 text-left font-medium">排名</th>
                <th className="px-4 py-3 text-left font-medium">玩家</th>
                <th className="px-4 py-3 text-left font-medium">用户标识</th>
                <th className="px-4 py-3 text-left font-medium">RKS</th>
                <th className="px-4 py-3 text-left font-medium">更新时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/70 dark:divide-neutral-800/70">
              {topItems.map((item) => (
                <tr
                  key={`${item.rank}-${item.user}`}
                  className="bg-white/80 transition-colors hover:bg-blue-50/60 dark:bg-neutral-900/60 dark:hover:bg-blue-900/20"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">{renderRankBadge(item.rank)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`text-sm font-medium ${
                          item.alias
                            ? 'text-gray-900 dark:text-gray-100'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {item.alias ?? '未设置别名'}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        最近同步 {formatDateTime(item.updated_at)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-neutral-800 dark:text-gray-300">
                      {`${item.user.substring(0, 8)}…`}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-blue-600 dark:text-blue-400">
                        {item.score.toFixed(4)}
                      </span>
                      {item.rank <= 3 && (
                        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-200">
                          TOP {item.rank}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {formatDateTime(item.updated_at)}
                  </td>
                </tr>
              ))}

              {topItems.length === 0 && !isTopLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-12">
                    <div className="flex flex-col items-center justify-center gap-2 text-center text-sm text-gray-500 dark:text-gray-400">
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 17v-6m6 6V5M5 21h14M13 13l2-2m0 0l2 2m-2-2v8"
                        />
                      </svg>
                      暂无排行榜数据，请稍后重试
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm shadow-gray-100/40 backdrop-blur-sm transition-colors dark:border-neutral-800 dark:bg-neutral-900/50 dark:shadow-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">我的排名</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                查询当前账号的 RKS 成绩、分位值与总人数
              </p>
            </div>
            <button
              type="button"
              onClick={handleFetchMyRank}
              disabled={isMyRankLoading}
              className={buttonStyles.primary}
            >
              {isMyRankLoading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" role="img">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
                    />
                  </svg>
                  同步中…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  同步我的排名
                </>
              )}
            </button>
          </div>

          {myRankError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
              {myRankError}
            </div>
          )}

          {myRank ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white/70 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/60">
                <p className="text-xs text-gray-500 dark:text-gray-400">当前名次</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  #{myRank.rank}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white/70 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/60">
                <p className="text-xs text-gray-500 dark:text-gray-400">RKS</p>
                <p className="mt-1 text-2xl font-semibold text-blue-600 dark:text-blue-400">
                  {myRank.score.toFixed(4)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white/70 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/60">
                <p className="text-xs text-gray-500 dark:text-gray-400">分位值</p>
                <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {formatPercent(myRank.percentile)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white/70 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/60">
                <p className="text-xs text-gray-500 dark:text-gray-400">记录总数</p>
                <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {myRank.total.toLocaleString()}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              尚未查询，请点击“同步我的排名”。若未登录，将提示先完成登录流程。
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm shadow-gray-100/40 backdrop-blur-sm transition-colors dark:border-neutral-800 dark:bg-neutral-900/50 dark:shadow-none">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">别名管理</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            绑定别名后，排行榜中会展示更友好的称呼，同时可用于公开档案查询。
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={aliasInput}
              onChange={(event) => setAliasInput(event.target.value)}
              placeholder="输入新的别名"
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={handleAliasUpdate}
              disabled={isAliasUpdating}
              className={buttonStyles.secondary}
            >
              {isAliasUpdating ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" role="img">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
                    />
                  </svg>
                  保存中…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  保存别名
                </>
              )}
            </button>
          </div>

          {aliasMessage && (
            <p className="mt-3 text-sm text-green-600 dark:text-green-400">{aliasMessage}</p>
          )}
          {aliasError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{aliasError}</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm shadow-gray-100/40 backdrop-blur-sm transition-colors dark:border-neutral-800 dark:bg-neutral-900/50 dark:shadow-none">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">公开设置</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              控制哪些信息向外公开，开启后即表示允许他人在公开档案中查看（档案默认不公开展示，须在下方修改配置）
            </p>
          </div>
          <button
            type="button"
            onClick={handleProfileUpdate}
            disabled={isProfileUpdating}
            className={buttonStyles.secondary}
          >
            {isProfileUpdating ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" role="img">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
                  />
                </svg>
                保存中…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                保存公开设置
              </>
            )}
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white/70 px-4 py-3 transition-colors hover:border-blue-300 dark:border-neutral-700 dark:bg-neutral-900/60 dark:hover:border-blue-700/60">
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                允许公开档案
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                关闭后，其他用户将无法通过别名查看你的信息，你的成绩也不会显示在排行榜中
              </p>
            </div>
            <input
              type="checkbox"
              checked={isProfilePublic}
              onChange={(event) => setIsProfilePublic(event.target.checked)}
              className="mt-1 h-4 w-4 accent-blue-600"
            />
          </label>
          <label className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white/70 px-4 py-3 transition-colors hover:border-blue-300 dark:border-neutral-700 dark:bg-neutral-900/60 dark:hover:border-blue-700/60">
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                显示 Best Top3
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                公共页面中展示单曲rks最高的三首歌曲
              </p>
            </div>
            <input
              type="checkbox"
              checked={showBestTop3}
              onChange={(event) => setShowBestTop3(event.target.checked)}
              className="mt-1 h-4 w-4 accent-blue-600"
            />
          </label>
          <label className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white/70 px-4 py-3 transition-colors hover:border-blue-300 dark:border-neutral-700 dark:bg-neutral-900/60 dark:hover:border-blue-700/60">
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                显示 AP Top3
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                展示AP成绩中中单曲rks最高的三首歌曲
              </p>
            </div>
            <input
              type="checkbox"
              checked={showApTop3}
              onChange={(event) => setShowApTop3(event.target.checked)}
              className="mt-1 h-4 w-4 accent-blue-600"
            />
          </label>
          <label className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white/70 px-4 py-3 transition-colors hover:border-blue-300 dark:border-neutral-700 dark:bg-neutral-900/60 dark:hover:border-blue-700/60">
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                显示 RKS 组成明细
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                包括 Best27 与 AP Top3 累积分值
              </p>
            </div>
            <input
              type="checkbox"
              checked={showRksComposition}
              onChange={(event) => setShowRksComposition(event.target.checked)}
              className="mt-1 h-4 w-4 accent-blue-600"
            />
          </label>
        </div>

        {profileMessage && (
          <p className="mt-4 text-sm text-green-600 dark:text-green-400">{profileMessage}</p>
        )}
        {profileError && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{profileError}</p>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm shadow-gray-100/40 backdrop-blur-sm transition-colors dark:border-neutral-800 dark:bg-neutral-900/50 dark:shadow-none">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">公开档案查询</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          输入别名可查看玩家公开信息，若玩家关闭公开功能则无法检索
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={lookupAlias}
            onChange={(event) => setLookupAlias(event.target.value)}
            placeholder="输入玩家别名，例如 Alice"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={handleLookupProfile}
            disabled={isLookupLoading || lookupAlias.trim().length === 0}
            className={buttonStyles.primary}
          >
            {isLookupLoading ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" role="img">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
                  />
                </svg>
                查询中…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 16l2-2 2 2 4-4"
                  />
                </svg>
                查询档案
              </>
            )}
          </button>
        </div>

        {lookupError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
            {lookupError}
          </div>
        )}

        {publicProfile ? (
          <div className="mt-6 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white/70 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/60">
                <p className="text-xs text-gray-500 dark:text-gray-400">别名</p>
                <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {publicProfile.alias}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white/70 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/60">
                <p className="text-xs text-gray-500 dark:text-gray-400">RKS</p>
                <p className="mt-1 text-lg font-semibold text-blue-600 dark:text-blue-400">
                  {publicProfile.score.toFixed(4)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white/70 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/60">
                <p className="text-xs text-gray-500 dark:text-gray-400">最近更新</p>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {formatDateTime(publicProfile.updated_at)}
                </p>
              </div>
              {publicProfile.rks_composition && (
                <div className="rounded-xl border border-gray-200 bg-white/70 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/60 sm:col-span-2 lg:col-span-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">RKS 组成</p>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                    Best27 合计 {publicProfile.rks_composition.best27_sum.toFixed(2)}，AP Top3 合计{' '}
                    {publicProfile.rks_composition.ap_top3_sum.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Best Top3
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {publicProfile.best_top3?.length ?? 0} 首
                  </span>
                </div>
                {renderChartItems(publicProfile.best_top3)}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    AP Top3
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {publicProfile.ap_top3?.length ?? 0} 首
                  </span>
                </div>
                {renderChartItems(publicProfile.ap_top3)}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            暂无档案数据。成功查询后会展示别名、RKS、更新时间以及 Top3 曲目。
          </p>
        )}
      </section>
    </div>
  );
}
