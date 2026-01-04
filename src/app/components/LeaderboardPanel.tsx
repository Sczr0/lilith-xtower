'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LeaderboardAPI } from '../lib/api/leaderboard';
import { formatFixedNumber, parseFiniteNumber } from '../lib/utils/number';
import type {
  LeaderboardMeResponse,
  LeaderboardTopItem,
  PublicProfileResponse,
} from '../lib/types/leaderboard';

const TOP_PAGE_SIZE = 20;

// 说明：以下 localStorage 仅用于本浏览器的回显与“未保存”判断，并不代表服务器当前真实状态。
const LEADERBOARD_ALIAS_STORAGE_KEY = 'leaderboard_alias_v1';
const LEADERBOARD_PROFILE_SETTINGS_STORAGE_KEY = 'leaderboard_profile_settings_v1';

type ProfileSettingsSnapshot = {
  isPublic: boolean;
  showBestTop3: boolean;
  showApTop3: boolean;
  showRksComposition: boolean;
};

const DEFAULT_PROFILE_SETTINGS: ProfileSettingsSnapshot = {
  isPublic: true,
  showBestTop3: true,
  showApTop3: true,
  showRksComposition: true,
};

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

const formatPercent = (value: unknown) => `${formatFixedNumber(value, 2)}%`;

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

const renderChartItems = (items: PublicProfileResponse['apTop3']) => {
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
          key={`${item.song}|${item.difficulty}|${item.acc}|${item.rks}`}
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
              {formatFixedNumber(item.acc, 2)}%
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
              {formatFixedNumber(item.rks, 4)}
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
  const [savedAlias, setSavedAlias] = useState('');

  const [isProfilePublic, setIsProfilePublic] = useState(true);
  const [showBestTop3, setShowBestTop3] = useState(true);
  const [showApTop3, setShowApTop3] = useState(true);
  const [showRksComposition, setShowRksComposition] = useState(true);
  const [isProfileUpdating, setIsProfileUpdating] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savedProfileSettings, setSavedProfileSettings] =
    useState<ProfileSettingsSnapshot>(DEFAULT_PROFILE_SETTINGS);

  const [lookupAlias, setLookupAlias] = useState('');
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfileResponse | null>(null);

  // 说明：复制提示（轻量提示，不引入 toast 依赖）
  const [copyHint, setCopyHint] = useState<string | null>(null);

  // 说明：用于“回到上方功能 / 自动滚动到公开档案查询”的锚点
  const topAnchorRef = useRef<HTMLDivElement | null>(null);
  const profileAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedAlias = localStorage.getItem(LEADERBOARD_ALIAS_STORAGE_KEY);
      if (storedAlias) {
        setSavedAlias(storedAlias);
        setAliasInput(storedAlias);
      }
    } catch {}

    try {
      const raw = localStorage.getItem(LEADERBOARD_PROFILE_SETTINGS_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<ProfileSettingsSnapshot> | null;
      const next: ProfileSettingsSnapshot = {
        isPublic: typeof parsed?.isPublic === 'boolean' ? parsed.isPublic : DEFAULT_PROFILE_SETTINGS.isPublic,
        showBestTop3:
          typeof parsed?.showBestTop3 === 'boolean' ? parsed.showBestTop3 : DEFAULT_PROFILE_SETTINGS.showBestTop3,
        showApTop3: typeof parsed?.showApTop3 === 'boolean' ? parsed.showApTop3 : DEFAULT_PROFILE_SETTINGS.showApTop3,
        showRksComposition:
          typeof parsed?.showRksComposition === 'boolean'
            ? parsed.showRksComposition
            : DEFAULT_PROFILE_SETTINGS.showRksComposition,
      };

      setSavedProfileSettings(next);
      setIsProfilePublic(next.isPublic);
      setShowBestTop3(next.showBestTop3);
      setShowApTop3(next.showApTop3);
      setShowRksComposition(next.showRksComposition);
    } catch {}
  }, []);

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
      const sortedItems = [...data.items].sort((a, b) => {
        const scoreA = parseFiniteNumber(a.score) ?? Number.NEGATIVE_INFINITY;
        const scoreB = parseFiniteNumber(b.score) ?? Number.NEGATIVE_INFINITY;
        const diff = scoreB - scoreA;
        if (diff !== 0) return diff;

        const timeA = Date.parse(a.updatedAt);
        const timeB = Date.parse(b.updatedAt);
        const tsA = Number.isNaN(timeA) ? 0 : timeA;
        const tsB = Number.isNaN(timeB) ? 0 : timeB;
        if (tsB !== tsA) return tsB - tsA;
        return String(a.user).localeCompare(String(b.user));
      });

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
      const nextAlias = aliasInput.trim();
      await LeaderboardAPI.updateAlias(credential, { alias: nextAlias });
      setSavedAlias(nextAlias);
      try {
        localStorage.setItem(LEADERBOARD_ALIAS_STORAGE_KEY, nextAlias);
      } catch {}
      setAliasInput(nextAlias);
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
      const nextSettings: ProfileSettingsSnapshot = {
        isPublic: isProfilePublic,
        showBestTop3,
        showApTop3,
        showRksComposition,
      };
      await LeaderboardAPI.updateProfileSettings(credential, {
        isPublic: isProfilePublic,
        showBestTop3: showBestTop3,
        showApTop3: showApTop3,
        showRksComposition: showRksComposition,
      });
      setSavedProfileSettings(nextSettings);
      try {
        localStorage.setItem(LEADERBOARD_PROFILE_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
      } catch {}
      setProfileMessage('公开设置已更新');
    } catch (error) {
      setProfileMessage(null);
      setProfileError(error instanceof Error ? error.message : '更新失败');
    } finally {
      setIsProfileUpdating(false);
    }
  };

  const handleLookupProfile = async (aliasOverride?: string) => {
    const alias = aliasOverride ?? lookupAlias;
    setLookupError(null);
    setIsLookupLoading(true);
    try {
      const data = await LeaderboardAPI.getPublicProfile(alias);
      setPublicProfile(data);
    } catch (error) {
      setPublicProfile(null);
      setLookupError(error instanceof Error ? error.message : '查询失败');
    } finally {
      setIsLookupLoading(false);
    }
  };

  const handleLookupFromLeaderboard = (alias: string) => {
    const safeAlias = alias.trim();
    if (!safeAlias) return;
    setLookupAlias(safeAlias);
    profileAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    handleLookupProfile(safeAlias).catch(() => {});
  };

  const handleScrollToTop = () => {
    topAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const copyText = async (value: string, label?: string) => {
    const text = value.trim();
    if (!text) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // 说明：兼容性兜底（旧浏览器）
        const el = document.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', 'true');
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        el.style.top = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopyHint(`已复制${label ? `：${label}` : ''}`);
    } catch {
      setCopyHint('复制失败，请手动复制');
    } finally {
      window.setTimeout(() => setCopyHint(null), 1600);
    }
  };

  const canLoadMore = useMemo(() => {
    if (topTotal === null) return false;
    return topItems.length < topTotal;
  }, [topItems.length, topTotal]);

  const isAliasDirty = useMemo(() => aliasInput.trim() !== savedAlias.trim(), [aliasInput, savedAlias]);

  const isProfileDirty = useMemo(() => {
    return (
      isProfilePublic !== savedProfileSettings.isPublic ||
      showBestTop3 !== savedProfileSettings.showBestTop3 ||
      showApTop3 !== savedProfileSettings.showApTop3 ||
      showRksComposition !== savedProfileSettings.showRksComposition
    );
  }, [isProfilePublic, savedProfileSettings, showApTop3, showBestTop3, showRksComposition]);

  return (
    <div className="space-y-8">
      <div ref={topAnchorRef} />

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
                  {formatFixedNumber(myRank.score, 4)}
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
          ) : !myRankError ? (
            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              尚未查询，请点击“同步我的排名”。若未登录，将提示先完成登录流程。
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm shadow-gray-100/40 backdrop-blur-sm transition-colors dark:border-neutral-800 dark:bg-neutral-900/50 dark:shadow-none">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">别名管理</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            绑定别名后，排行榜中会展示更友好的称呼，同时可用于公开档案查询。
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
            {savedAlias
              ? `上次保存的别名（本浏览器）：${savedAlias}`
              : '提示：保存后会在本浏览器自动回显（跨设备/跨浏览器不一定一致）。'}
          </p>

          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              handleAliasUpdate().catch(() => {});
            }}
          >
            <label className="sr-only" htmlFor="leaderboard-alias-input">
              新的别名
            </label>
            <input
              id="leaderboard-alias-input"
              value={aliasInput}
              onChange={(event) => setAliasInput(event.target.value)}
              placeholder="输入新的别名"
              autoComplete="off"
              className="flex-1 min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100"
            />
            <button
              type="submit"
              disabled={isAliasUpdating || aliasInput.trim().length === 0 || !isAliasDirty}
              className={`${buttonStyles.secondary} flex-shrink-0 whitespace-nowrap`}
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
          </form>

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
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">公开设置</h2>
              {isProfileDirty && !isProfileUpdating && (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
                  未保存
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              控制哪些信息向外公开，开启后即表示允许他人在公开档案中查看（档案默认不公开展示，须在下方修改配置）
            </p>
          </div>
          <button
            type="button"
            onClick={handleProfileUpdate}
            disabled={isProfileUpdating || !isProfileDirty}
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
                公共页面中展示单曲 RKS 最高的三首歌曲
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
                展示 AP 成绩中单曲 RKS 最高的三首歌曲
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
        <div ref={profileAnchorRef} />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">公开档案查询</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          输入别名可查看玩家公开信息，若玩家关闭公开功能则无法检索
        </p>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
          提示：在下方榜单中点击玩家别名，可自动填入并查询。
        </p>

        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            handleLookupProfile().catch(() => {});
          }}
        >
          <label className="sr-only" htmlFor="leaderboard-profile-lookup">
            玩家别名
          </label>
          <input
            id="leaderboard-profile-lookup"
            value={lookupAlias}
            onChange={(event) => setLookupAlias(event.target.value)}
            placeholder="输入玩家别名，例如 Alice"
            autoComplete="off"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100"
          />
          <button
            type="submit"
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
        </form>

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
                  {formatFixedNumber(publicProfile.score, 4)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white/70 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/60">
                <p className="text-xs text-gray-500 dark:text-gray-400">最近更新</p>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {formatDateTime(publicProfile.updatedAt)}
                </p>
              </div>
              {publicProfile.rksComposition && (
                <div className="rounded-xl border border-gray-200 bg-white/70 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/60 sm:col-span-2 lg:col-span-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">RKS 组成</p>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                    Best27 合计 {formatFixedNumber(publicProfile.rksComposition.best27Sum, 2)}，AP Top3 合计{' '}
                    {formatFixedNumber(publicProfile.rksComposition.apTop3Sum, 2)}
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
                    {publicProfile.bestTop3?.length ?? 0} 首
                  </span>
                </div>
                {renderChartItems(publicProfile.bestTop3)}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    AP Top3
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {publicProfile.apTop3?.length ?? 0} 首
                  </span>
                </div>
                {renderChartItems(publicProfile.apTop3)}
              </div>
            </div>
          </div>
        ) : !lookupError && !isLookupLoading ? (
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            暂无档案数据。成功查询后会展示别名、RKS、更新时间以及 Top3 曲目。
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm shadow-gray-100/40 backdrop-blur-sm transition-colors dark:border-neutral-800 dark:bg-neutral-900/50 dark:shadow-none">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 sm:text-xl">
              RKS 榜单
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              参考全站最新同步的玩家成绩，数据每次操作实时刷新
            </p>
            {copyHint && <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{copyHint}</p>}
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

        {/* 移动端卡片列表 */}
        <div className="mt-4 space-y-3 md:hidden">
          {topItems.map((item) => (
            <div
              key={`mobile-${item.rank}-${item.user}`}
              className="rounded-xl border border-gray-200 bg-white/80 p-4 transition-colors hover:border-blue-300 dark:border-neutral-700 dark:bg-neutral-900/60 dark:hover:border-blue-700/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {renderRankBadge(item.rank)}
                  <div className="min-w-0 flex-1">
                    {item.alias ? (
                      <button
                        type="button"
                        onClick={() => handleLookupFromLeaderboard(item.alias ?? '')}
                        className="text-left text-sm font-medium truncate text-gray-900 hover:text-blue-700 hover:underline dark:text-gray-100 dark:hover:text-blue-200"
                        title="点击查询公开档案"
                      >
                        {item.alias}
                      </button>
                    ) : (
                      <p className="text-sm font-medium truncate text-gray-400 dark:text-gray-500">
                        未设置别名
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => copyText(item.user, '用户标识')}
                      title="点击复制用户标识"
                      className="mt-1 inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-neutral-800 dark:text-gray-300"
                    >
                      <span className="font-mono">{`${item.user.substring(0, 8)}…`}</span>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    {formatFixedNumber(item.score, 4)}
                  </p>
                  {item.rank <= 3 && (
                    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-200">
                      TOP {item.rank}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>最近同步 {formatDateTime(item.updatedAt)}</span>
              </div>
            </div>
          ))}

          {topItems.length === 0 && !isTopLoading && !topError && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white/60 px-4 py-12 text-center text-sm text-gray-500 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-gray-400">
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
          )}
        </div>

        {/* 桌面端表格 */}
        <div className="mt-4 hidden overflow-x-auto md:block">
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
                  key={`desktop-${item.rank}-${item.user}`}
                  className="bg-white/80 transition-colors hover:bg-blue-50/60 dark:bg-neutral-900/60 dark:hover:bg-blue-900/20"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">{renderRankBadge(item.rank)}</div>
                  </td>
                  <td className="px-4 py-3">
                    {item.alias ? (
                      <button
                        type="button"
                        onClick={() => handleLookupFromLeaderboard(item.alias ?? '')}
                        className="text-left text-sm font-medium text-gray-900 hover:text-blue-700 hover:underline dark:text-gray-100 dark:hover:text-blue-200"
                        title="点击查询公开档案"
                      >
                        {item.alias}
                      </button>
                    ) : (
                      <span className="text-sm font-medium text-gray-400 dark:text-gray-500">
                        未设置别名
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => copyText(item.user, '用户标识')}
                      title="点击复制用户标识"
                      className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-neutral-800 dark:text-gray-300"
                    >
                      <span className="font-mono">{`${item.user.substring(0, 8)}…`}</span>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-blue-600 dark:text-blue-400">
                        {formatFixedNumber(item.score, 4)}
                      </span>
                      {item.rank <= 3 && (
                        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-200">
                          TOP {item.rank}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {formatDateTime(item.updatedAt)}
                  </td>
                </tr>
              ))}

              {topItems.length === 0 && !isTopLoading && !topError && (
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

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
          <button type="button" onClick={handleScrollToTop} className={buttonStyles.secondary}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
            回到上方功能
          </button>
        </div>
      </section>
    </div>
  );
}
