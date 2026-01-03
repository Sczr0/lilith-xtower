"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RotatingTips } from './RotatingTips';
import { StatsLineChart } from './charts/StatsLineChart';
import { ScoreAPI } from '../lib/api/score';
import { getRecentYmdRange, normalizeIanaTimeZone } from '../lib/utils/date';
import type { DailyDauResponse, DailyHttpResponse, ServiceStatsFeature, ServiceStatsResponse } from '../lib/types/score';

type Props = {
  variant?: 'default' | 'mono';
  showTitle?: boolean;
  // 控制是否显示组件内的描述，避免与外层重复
  showDescription?: boolean;
};

type CachedPayload = {
  stats: ServiceStatsResponse;
  ts?: number;
  version?: number;
};

type FeatureCategory = 'primary' | 'secondary';

type FeatureMeta = {
  label: string;
  category: FeatureCategory;
  createIcon: (className: string) => React.ReactElement;
};

const CACHE_KEY = 'cache_service_stats_v3';
const CACHE_VERSION = 1;
const CACHE_TTL_MS = 5 * 60 * 1000;

const createBarChartIcon = (className: string) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const createSingleQueryIcon = (className: string) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
    />
  </svg>
);

const createSaveIcon = (className: string) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const createCheckIcon = (className: string) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const createSearchIcon = (className: string) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
  </svg>
);

const createImageIcon = (className: string) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a2 2 0 012-2h12a2 2 0 012 2v8l-4-3-4 5-3-4-5 6z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h.01M15 9h.01" />
  </svg>
);

const createDefaultIcon = (className: string) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h18M3 12h12M3 19h6" />
  </svg>
);

const FEATURE_META: Record<string, FeatureMeta> = {
  bestn: { label: 'Best N 图片', category: 'primary', createIcon: createBarChartIcon },
  single_query: { label: '单曲查询', category: 'primary', createIcon: createSingleQueryIcon },
  save: { label: '存档获取', category: 'primary', createIcon: createSaveIcon },
  song_search: { label: '歌曲检索', category: 'secondary', createIcon: createSearchIcon },
  bestn_user: { label: '用户自报 BestN', category: 'secondary', createIcon: createCheckIcon },
  image_render: { label: '图片渲染', category: 'secondary', createIcon: createImageIcon },
  image_cache: { label: '图片缓存', category: 'secondary', createIcon: createImageIcon },
};

const formatFeatureLabel = (key: string) =>
  key
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const defaultFeatureMeta = (key: string): FeatureMeta => ({
  label: formatFeatureLabel(key),
  category: 'secondary',
  createIcon: createDefaultIcon,
});

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatUserKind = (kind: string) => {
  switch (kind) {
    case 'session_token':
      return 'SessionToken';
    case 'platform_pair':
      return '平台绑定';
    case 'external_api_user_id':
      return '外部 API 用户';
    default:
      return kind;
  }
};

export function ServiceStats({ variant = 'default', showTitle = true, showDescription = true }: Props) {
  const [stats, setStats] = useState<ServiceStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const TRENDS_DAYS = 14;

  const [dailyDau, setDailyDau] = useState<DailyDauResponse | null>(null);
  const [dailyHttp, setDailyHttp] = useState<DailyHttpResponse | null>(null);
  const [trendRange, setTrendRange] = useState<{ start: string; end: string; timezone: string } | null>(null);
  const [isTrendsLoading, setIsTrendsLoading] = useState(false);
  const [trendsError, setTrendsError] = useState<string | null>(null);
  const [hasRequestedTrends, setHasRequestedTrends] = useState(false);

  const loadStats = useCallback(async (): Promise<ServiceStatsResponse | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ScoreAPI.getServiceStats();
      setStats(data);
      try {
        const payload: CachedPayload = { stats: data, ts: Date.now(), version: CACHE_VERSION };
        localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      } catch {
        // ignore cache write errors
      }
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载统计数据失败');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadTrends = useCallback(async (timezone: string) => {
    const tz = normalizeIanaTimeZone(timezone);
    const { start, end } = getRecentYmdRange(tz, TRENDS_DAYS);
    setTrendRange({ start, end, timezone: tz });
    setIsTrendsLoading(true);
    setTrendsError(null);

    try {
      const [dau, http] = await Promise.all([
        ScoreAPI.getDailyDau({ start, end, timezone: tz }),
        ScoreAPI.getDailyHttp({ start, end, timezone: tz }),
      ]);
      setDailyDau(dau);
      setDailyHttp(http);
    } catch (e) {
      setTrendsError(e instanceof Error ? e.message : '加载趋势数据失败');
    } finally {
      setIsTrendsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    const data = await loadStats();
    const timezone = data?.timezone ?? stats?.timezone;
    if (timezone) {
      setHasRequestedTrends(true);
      await loadTrends(timezone);
    }
  }, [loadStats, loadTrends, stats?.timezone]);

  useEffect(() => {
    const readCache = () => {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return false;
        const parsed = JSON.parse(cached) as CachedPayload;
        if (parsed.version !== CACHE_VERSION || !parsed.stats) return false;
        setStats(parsed.stats);
        const isFresh = typeof parsed.ts === 'number' && Date.now() - parsed.ts < CACHE_TTL_MS;
        return isFresh;
      } catch {
        return false;
      }
    };

    const hasFreshCache = readCache();
    if (!hasFreshCache) {
      void loadStats();
    }
  }, [loadStats]);

  useEffect(() => {
    if (!stats || hasRequestedTrends) return;
    setHasRequestedTrends(true);
    void loadTrends(stats.timezone);
  }, [hasRequestedTrends, loadTrends, stats]);

  const containerClasses =
    variant === 'mono'
      ? 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm w-full max-w-4xl mx-auto'
      : 'bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-6 shadow-lg w-full max-w-4xl mx-auto';
  const cardClass = 'rounded-xl p-5 border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900';
  const chartCardClass = 'rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden';
  const iconClass = 'w-6 h-6 text-gray-500 dark:text-gray-400';
  const countClass = 'text-2xl font-bold text-gray-900 dark:text-gray-100';

  const groupedFeatures = useMemo(() => {
    if (!stats) return { primary: [] as Array<{ feature: ServiceStatsFeature; meta: FeatureMeta }>, secondary: [] as Array<{ feature: ServiceStatsFeature; meta: FeatureMeta }> };
    return stats.features.reduce(
      (acc, feature) => {
        const meta = FEATURE_META[feature.key] ?? defaultFeatureMeta(feature.key);
        acc[meta.category].push({ feature, meta });
        return acc;
      },
      {
        primary: [] as Array<{ feature: ServiceStatsFeature; meta: FeatureMeta }>,
        secondary: [] as Array<{ feature: ServiceStatsFeature; meta: FeatureMeta }>,
      },
    );
  }, [stats]);

  const dauChart = useMemo(() => {
    if (!dailyDau || dailyDau.rows.length === 0) return null;
    const rows = [...dailyDau.rows].sort((a, b) => a.date.localeCompare(b.date));
    return {
      xAxis: rows.map((row) => (row.date.length >= 10 ? row.date.slice(5) : row.date)),
      series: [
        { name: '活跃用户', data: rows.map((row) => row.activeUsers), color: '#3b82f6', area: true },
        { name: '活跃 IP', data: rows.map((row) => row.activeIps), color: '#22c55e' },
      ],
    };
  }, [dailyDau]);

  const httpChart = useMemo(() => {
    if (!dailyHttp || dailyHttp.totals.length === 0) return null;
    const rows = [...dailyHttp.totals].sort((a, b) => a.date.localeCompare(b.date));
    return {
      xAxis: rows.map((row) => (row.date.length >= 10 ? row.date.slice(5) : row.date)),
      series: [
        { name: '请求总量', data: rows.map((row) => row.total), color: '#a855f7', area: true },
        { name: '错误数', data: rows.map((row) => row.errors), color: '#ef4444' },
      ],
    };
  }, [dailyHttp]);

  return (
    <section className={containerClasses}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          {showTitle && <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">服务统计</h2>}
          {showDescription && (
            <p className="text-sm text-gray-600 dark:text-gray-400">查看服务使用情况、功能调用次数以及唯一用户来源。</p>
          )}
        </div>
        <button
          onClick={() => void refreshAll()}
          disabled={isLoading || isTrendsLoading}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-4 py-2 transition-colors"
        >
          {isLoading || isTrendsLoading ? '刷新中...' : '刷新'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

{isLoading && !stats ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" aria-label="loading spinner" />
          <RotatingTips />
        </div>
      ) : stats ? (
        <>
          <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-gray-200 dark:border-neutral-800 p-3 text-sm">
              <div className="text-gray-500 dark:text-gray-400">最近活动</div>
              <div className="text-gray-900 dark:text-gray-100 mt-1">{formatDateTime(stats.lastEventAt)}</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-neutral-800 p-3 text-sm">
              <div className="text-gray-500 dark:text-gray-400">首次记录</div>
              <div className="text-gray-900 dark:text-gray-100 mt-1">{formatDateTime(stats.firstEventAt)}</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-neutral-800 p-3 text-sm">
              <div className="text-gray-500 dark:text-gray-400">唯一用户</div>
              <div className="text-gray-900 dark:text-gray-100 mt-1">{stats.uniqueUsers.total.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-neutral-800 p-3 text-sm">
              <div className="text-gray-500 dark:text-gray-400">时区</div>
              <div className="text-gray-900 dark:text-gray-100 mt-1">{stats.timezone}</div>
            </div>
          </div>

          {stats.configStartAt && (
            <div className="mb-4 text-xs text-gray-500 dark:text-gray-400">
              统计配置起始时间：{formatDateTime(stats.configStartAt)}
            </div>
          )}

          {stats.uniqueUsers.byKind.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2 text-sm">
              {stats.uniqueUsers.byKind.map(([kind, count], idx) => (
                <span
                  key={`${kind}-${idx}`}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-neutral-800 px-3 py-1 bg-white/80 dark:bg-neutral-900/80"
                >
                  <span className="text-gray-500 dark:text-gray-400">{formatUserKind(kind)}</span>
                  <span className="text-gray-900 dark:text-gray-100">{count.toLocaleString()}</span>
                </span>
              ))}
            </div>
          )}

          {(groupedFeatures.primary.length > 0 || groupedFeatures.secondary.length > 0) ? (
            <>
              {groupedFeatures.primary.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {groupedFeatures.primary.map(({ feature, meta }) => (
                    <div key={feature.key} className={cardClass}>
                      <div className="flex items-center mb-3">
                        {meta.createIcon(iconClass)}
                        <h3 className="ml-2 text-lg font-semibold text-gray-900 dark:text-gray-100">{meta.label}</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                          <span className="text-sm text-gray-600 dark:text-gray-400">使用次数</span>
                          <span className={countClass}>{feature.count.toLocaleString()}</span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-500">
                          最后使用 {formatDateTime(feature.lastUpdated)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {groupedFeatures.secondary.length > 0 && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {groupedFeatures.secondary.map(({ feature, meta }) => (
                    <div key={feature.key} className={cardClass}>
                      <div className="flex items-center mb-3">
                        {meta.createIcon(iconClass)}
                        <h3 className="ml-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {meta.label || formatFeatureLabel(feature.key)}
                        </h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                          <span className="text-sm text-gray-600 dark:text-gray-400">使用次数</span>
                          <span className={countClass}>{feature.count.toLocaleString()}</span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-500">
                          最后使用 {formatDateTime(feature.lastUpdated)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
              暂无功能使用统计。
            </div>
          )}

          <div className="mt-8 space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">近 {TRENDS_DAYS} 天趋势</h3>
                {trendRange && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {trendRange.start} ~ {trendRange.end} · {trendRange.timezone}
                  </p>
                )}
              </div>
              {isTrendsLoading && (
                <span className="text-xs text-gray-500 dark:text-gray-400">更新中…</span>
              )}
            </div>

            {trendsError && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                {trendsError}
              </div>
            )}

            {isTrendsLoading && !dauChart && !httpChart ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" aria-label="loading spinner" />
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">正在加载趋势数据…</div>
              </div>
            ) : dauChart || httpChart ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={chartCardClass}>
                  {dauChart ? (
                    <StatsLineChart title="每日活跃" xAxis={dauChart.xAxis} series={dauChart.series} height={280} />
                  ) : (
                    <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">暂无活跃趋势数据</div>
                  )}
                </div>
                <div className={chartCardClass}>
                  {httpChart ? (
                    <StatsLineChart title="每日 HTTP" xAxis={httpChart.xAxis} series={httpChart.series} height={280} />
                  ) : (
                    <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">暂无 HTTP 趋势数据</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                暂无趋势数据
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          暂无统计数据
        </div>
      )}
    </section>
  );
}
