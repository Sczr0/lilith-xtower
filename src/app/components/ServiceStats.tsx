"use client";

import { useEffect, useState } from 'react';
import { ScoreAPI } from '../lib/api/score';
import { ServiceStatsResponse } from '../lib/types/score';

type Props = {
  variant?: 'default' | 'mono';
  showTitle?: boolean;
  // 控制是否显示组件内的描述，避免与外层重复
  showDescription?: boolean;
};

export function ServiceStats({ variant = 'default', showTitle = true, showDescription = true }: Props) {
  const [stats, setStats] = useState<ServiceStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const CACHE_KEY = 'cache_service_stats_v2';
  const CACHE_TTL_MS = 5 * 60 * 1000;

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as { stats: ServiceStatsResponse; ts?: number };
        if (parsed?.stats) setStats(parsed.stats);
        const isFresh = typeof parsed?.ts === 'number' && Date.now() - parsed.ts < CACHE_TTL_MS;
        if (!isFresh) loadStats();
        return;
      }
    } catch {}
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ScoreAPI.getServiceStats();
      setStats(data);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ stats: data, ts: Date.now() }));
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载统计数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (s?: string | null) => {
    if (!s) return '-';
    const d = new Date(s);
    return d.toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  };

  const containerClasses = variant === 'mono'
    ? 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm w-full max-w-4xl mx-auto'
    : 'bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-6 shadow-lg w-full max-w-4xl mx-auto';
  const cardClass = 'rounded-xl p-5 border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900';
  const iconClass = 'w-6 h-6 text-gray-500 dark:text-gray-400 mr-2';
  const countClass = 'text-2xl font-bold text-gray-900 dark:text-gray-100';

  return (
    <section className={containerClasses}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          {showTitle && (
            <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">服务统计</h2>
          )}
          {showDescription && (
            <p className="text-sm text-gray-600 dark:text-gray-400">查看服务使用情况和统计数据</p>
          )}
        </div>
        <button
          onClick={loadStats}
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-4 py-2 transition-colors"
        >
          {isLoading ? '刷新中...' : '刷新'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      {isLoading && !stats ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : stats ? (
        <>
          {/* 摘要信息 */}
          <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-gray-200 dark:border-neutral-800 p-3 text-sm">
              <div className="text-gray-500 dark:text-gray-400">最近活跃</div>
              <div className="text-gray-900 dark:text-gray-100 mt-1">{formatDate(stats.time?.last_event_at)}</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-neutral-800 p-3 text-sm">
              <div className="text-gray-500 dark:text-gray-400">首次记录</div>
              <div className="text-gray-900 dark:text-gray-100 mt-1">{formatDate(stats.time?.first_event_at)}</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-neutral-800 p-3 text-sm">
              <div className="text-gray-500 dark:text-gray-400">唯一用户</div>
              <div className="text-gray-900 dark:text-gray-100 mt-1">{stats.users?.total ?? 0}</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-neutral-800 p-3 text-sm">
              <div className="text-gray-500 dark:text-gray-400">时区</div>
              <div className="text-gray-900 dark:text-gray-100 mt-1">{stats.time?.timezone || '-'}</div>
            </div>
          </div>

          {/* 用户分布 */}
          {stats.users?.by_kind && stats.users.by_kind.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2 text-sm">
              {stats.users.by_kind.map(([kind, count], idx) => (
                <span key={idx} className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-neutral-800 px-3 py-1">
                  <span className="text-gray-500 dark:text-gray-400">{kind === 'session_token' ? 'SessionToken' : kind === 'platform_pair' ? '平台绑定' : kind}</span>
                  <span className="text-gray-900 dark:text-gray-100">{count}</span>
                </span>
              ))}
            </div>
          )}

          {/* 主功能卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={cardClass}>
              <div className="flex items-center mb-3">
                <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Best N 图片</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-baseline"><span className="text-sm text-gray-600 dark:text-gray-400">使用次数</span><span className={countClass}>{stats.bn.count.toLocaleString()}</span></div>
                <div className="text-xs text-gray-500 dark:text-gray-500">最后使用 {formatDate(stats.bn.last_updated)}</div>
              </div>
            </div>

            <div className={cardClass}>
              <div className="flex items-center mb-3">
                <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">单曲查询</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-baseline"><span className="text-sm text-gray-600 dark:text-gray-400">使用次数</span><span className={countClass}>{stats.song.count.toLocaleString()}</span></div>
                <div className="text-xs text-gray-500 dark:text-gray-500">最后使用 {formatDate(stats.song.last_updated)}</div>
              </div>
            </div>

            {stats.leaderboard && stats.leaderboard.count > 0 && (
              <div className={cardClass}>
                <div className="flex items中心 mb-3">
                  <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">排行榜</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline"><span className="text-sm text-gray-600 dark:text-gray-400">使用次数</span><span className={countClass}>{stats.leaderboard.count.toLocaleString()}</span></div>
                  <div className="text-xs text-gray-500 dark:text-gray-500">最后使用 {formatDate(stats.leaderboard.last_updated)}</div>
                </div>
              </div>
            )}
          </div>

          {(!!stats.save || !!stats.bestn_user || !!stats.song_search) && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats.save && (
                <div className={cardClass}>
                  <div className="flex items-center mb-3">
                    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">存档获取</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline"><span className="text-sm text-gray-600 dark:text-gray-400">使用次数</span><span className={countClass}>{stats.save.count.toLocaleString()}</span></div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">最后使用 {formatDate(stats.save.last_updated)}</div>
                  </div>
                </div>
              )}

              {stats.bestn_user && (
                <div className={cardClass}>
                  <div className="flex items-center mb-3">
                    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">用户自报 BestN</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline"><span className="text-sm text-gray-600 dark:text-gray-400">使用次数</span><span className={countClass}>{stats.bestn_user.count.toLocaleString()}</span></div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">最后使用 {formatDate(stats.bestn_user.last_updated)}</div>
                  </div>
                </div>
              )}

              {stats.song_search && (
                <div className={cardClass}>
                  <div className="flex items-center mb-3">
                    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">歌曲检索</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline"><span className="text-sm text-gray-600 dark:text-gray-400">使用次数</span><span className={countClass}>{stats.song_search.count.toLocaleString()}</span></div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">最后使用 {formatDate(stats.song_search.last_updated)}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">暂无统计数据</div>
      )}
    </section>
  );
}
