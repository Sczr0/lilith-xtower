'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ScoreAPI } from '../lib/api/score';
import { formatFixedNumber, parseFiniteNumber } from '../lib/utils/number';
import { RksHistoryItem, RksHistoryResponse } from '../lib/types/score';

interface RksHistoryPanelProps {
  showTitle?: boolean;
}

const EMPTY_HISTORY_ITEMS: RksHistoryItem[] = [];

// 简单的 SVG 折线图组件
function RksLineChart({ items }: { items: RksHistoryItem[] }) {
  // 反转数组使其按时间正序排列（用于绘图）
  const sortedItems = useMemo(() => [...items].reverse(), [items]);
  
  if (sortedItems.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
        数据点不足，无法绘制趋势图
      </div>
    );
  }

  const rksValues = sortedItems.map(item => item.rks);
  const minRks = Math.min(...rksValues);
  const maxRks = Math.max(...rksValues);
  const range = maxRks - minRks || 1; // 避免除以零

  const width = 100;
  const height = 100;
  const padding = 10;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // 生成路径点
  const points = sortedItems.map((item, index) => {
    const x = padding + (index / (sortedItems.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((item.rks - minRks) / range) * chartHeight;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  // 生成填充区域
  const areaD = `M ${padding},${padding + chartHeight} L ${points.join(' L ')} L ${padding + chartWidth},${padding + chartHeight} Z`;

  return (
    <div className="relative h-32">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        {/* 填充区域 */}
        <path
          d={areaD}
          fill="url(#gradient)"
          opacity="0.3"
        />
        {/* 折线 */}
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-blue-500 dark:text-blue-400"
          vectorEffect="non-scaling-stroke"
        />
        {/* 渐变定义 */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" className="text-blue-500 dark:text-blue-400" stopColor="currentColor" stopOpacity="0.4" />
            <stop offset="100%" className="text-blue-500 dark:text-blue-400" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      {/* Y 轴标签 */}
      <div className="absolute left-0 top-0 text-xs text-gray-500 dark:text-gray-400">
        {formatFixedNumber(maxRks, 2)}
      </div>
      <div className="absolute left-0 bottom-0 text-xs text-gray-500 dark:text-gray-400">
        {formatFixedNumber(minRks, 2)}
      </div>
    </div>
  );
}

// 格式化时间显示
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays === 1) {
    return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }
}

export function RksHistoryPanel({ showTitle = true }: RksHistoryPanelProps) {
  const { credential } = useAuth();
  const [historyData, setHistoryData] = useState<RksHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadedCount, setLoadedCount] = useState(20);

  // 所有 useMemo hooks 必须在条件返回之前调用
  const items = historyData?.items ?? EMPTY_HISTORY_ITEMS;
  const total = historyData?.total ?? 0;
  const current_rks = historyData?.current_rks ?? 0;
  const peak_rks = historyData?.peak_rks ?? 0;
  const gap = peak_rks - current_rks;
  
  // 只保留有实际变化的记录（rks_jump !== 0）
  const changedItems = useMemo(
    () =>
      items.filter((item) => {
        const rks = parseFiniteNumber(item.rks);
        const jump = parseFiniteNumber(item.rks_jump);
        if (rks === null || jump === null) return false;
        return jump !== 0;
      }),
    [items],
  );
  const displayItems = isExpanded ? changedItems.slice(0, loadedCount) : changedItems.slice(0, 5);
  
  // 计算距离上次变化的时间
  const lastChangeTime = changedItems.length > 0 ? changedItems[0].created_at : null;
  const daysSinceLastChange = useMemo(() => {
    if (!lastChangeTime) return null;
    const lastDate = new Date(lastChangeTime);
    const now = new Date();
    const diffMs = now.getTime() - lastDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }, [lastChangeTime]);

  useEffect(() => {
    if (!credential) return;

    const loadHistory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await ScoreAPI.getRksHistory(credential, { limit: 50 });
        setHistoryData(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : '加载失败';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, [credential]);

  const loadMore = async () => {
    if (!credential || !historyData) return;
    
    try {
      const data = await ScoreAPI.getRksHistory(credential, {
        limit: 50,
        offset: historyData.items.length,
      });
      setHistoryData(prev => prev ? {
        ...prev,
        items: [...prev.items, ...data.items],
      } : data);
      setLoadedCount(prev => prev + 20);
    } catch (err) {
      console.error('加载更多失败:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-6 shadow-lg mb-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">加载 RKS 历史记录...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-6 shadow-lg mb-6">
        <div className="text-center py-4">
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!historyData || historyData.items.length === 0) {
    return (
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-6 shadow-lg mb-6">
        <div className="text-center py-4">
          <p className="text-gray-500 dark:text-gray-400 text-sm">暂无 RKS 历史记录</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-6 shadow-lg mb-6">
      {showTitle && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          RKS 历史变化
        </h3>
      )}

      {/* 概览卡片 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
          <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">当前 RKS</div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {formatFixedNumber(current_rks, 2)}
          </div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
          <div className="text-xs text-purple-600 dark:text-purple-400 mb-1">历史最高</div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
            {formatFixedNumber(peak_rks, 2)}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">距最高</div>
          <div className={`text-2xl font-bold ${gap === 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
            {gap === 0 ? '🎉' : `-${formatFixedNumber(gap, 2)}`}
          </div>
        </div>
      </div>

      {/* 距上次变化提示 */}
      {daysSinceLastChange !== null && daysSinceLastChange > 0 && (
        <div className="mb-4 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">
              距离上次 RKS 变化已过去 <strong>{daysSinceLastChange}</strong> 天
              {daysSinceLastChange >= 7 && '，继续加油！'}
            </span>
          </div>
        </div>
      )}

      {/* 趋势图 - 只使用有变化的数据点 */}
      <div className="mb-6">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">RKS 趋势</div>
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
          <RksLineChart items={changedItems.slice(0, 30)} />
        </div>
      </div>

      {/* 历史记录列表 - 只显示有变化的记录 */}
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-3"
        >
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          RKS 变化记录 (共 {changedItems.length} 次变化)
        </button>

        {changedItems.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
            暂无 RKS 变化记录
          </div>
        ) : (
          <>
            <div className={`space-y-2 overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[500px] overflow-y-auto' : 'max-h-[200px]'}`}>
              {displayItems.map((item, index) => (
                <div
                  key={`${item.created_at}-${index}`}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg"
                >
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {formatTime(item.created_at)}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatFixedNumber(item.rks, 2)}
                    </span>
                    <span className={`text-sm font-medium ${
                      item.rks_jump > 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {(() => {
                        const jump = parseFiniteNumber(item.rks_jump);
                        return `${jump !== null && jump > 0 ? '+' : ''}${formatFixedNumber(jump, 2)}`;
                      })()}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* 加载更多按钮 */}
            {isExpanded && loadedCount < changedItems.length && (
              <button
                onClick={() => setLoadedCount(prev => prev + 20)}
                className="w-full mt-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              >
                显示更多
              </button>
            )}
            
            {/* 如果已加载的变化记录不够，且还有更多原始数据可加载 */}
            {isExpanded && changedItems.length < total && items.length < total && (
              <button
                onClick={loadMore}
                className="w-full mt-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              >
                加载更多历史数据
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default RksHistoryPanel;
