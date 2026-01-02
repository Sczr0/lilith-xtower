'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { RotatingTips } from './RotatingTips';
import { useAuth } from '../contexts/AuthContext';
import { ScoreAPI } from '../lib/api/score';
import { RksRecord } from '../lib/types/score';
import { DIFFICULTY_BG, DIFFICULTY_TEXT } from '../lib/constants/difficultyColors';
import { ScoreCard } from './ScoreCard';
import type { AuthCredential } from '../lib/types/auth';
import { getOwnerKey } from '../lib/utils/cache';
import { StyledSelect } from './ui/Select';
import { RksHistoryPanel } from './RksHistoryPanel';
import { filterSortLimitRksRecords, type RksSortBy, type RksSortOrder } from '../lib/utils/rksRecords';

const parseNumberOrNull = (value: string): number | null => {
  const raw = value.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseIntegerOrNull = (value: string): number | null => {
  const raw = value.trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

// 支持通过 showDescription 隐藏组件内的描述，避免与外层重复
function RksRecordsListInner({ showTitle = true, showDescription = true }: { showTitle?: boolean; showDescription?: boolean }) {
  const { credential } = useAuth();
  const [records, setRecords] = useState<RksRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<RksSortBy>('rks');
  const [sortOrder, setSortOrder] = useState<RksSortOrder>('desc');
  const [filterDifficulty, setFilterDifficulty] = useState<'all' | 'EZ' | 'HD' | 'IN' | 'AT'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [minRks, setMinRks] = useState('');
  const [maxRks, setMaxRks] = useState('');
  const [minAcc, setMinAcc] = useState('');
  const [maxAcc, setMaxAcc] = useState('');
  const [minDifficultyValue, setMinDifficultyValue] = useState('');
  const [maxDifficultyValue, setMaxDifficultyValue] = useState('');
  const [minScore, setMinScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [onlyPositiveRks, setOnlyPositiveRks] = useState(false);
  const [limitCount, setLimitCount] = useState('');
  const CACHE_KEY = 'cache_rks_records_v2';

  // getOwnerKey 复用工具，按用户隔离缓存

  useEffect(() => {
    let hasCachedRecords = false;
    // 先读缓存渲染（按用户隔离）
    try {
      const ownerKey = getOwnerKey(credential as AuthCredential);
      const cached = localStorage.getItem(CACHE_KEY);
      if (ownerKey && cached) {
        const map = JSON.parse(cached) as Record<string, { records: RksRecord[]; ts?: number }>;
        const entry = map?.[ownerKey];
        if (entry && Array.isArray(entry.records)) {
          setRecords(entry.records);
          hasCachedRecords = true;
        }
      }
    } catch {}

    if (credential) {
      void loadRecords({ showLoading: !hasCachedRecords });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credential]);

  const loadRecords = async (options?: { showLoading?: boolean }) => {
    if (!credential) {
      setError('未找到登录凭证，请重新登录。');
      return;
    }

    const showLoading = options?.showLoading ?? records.length === 0;
    setIsLoading(showLoading);
    setError(null);

    try {
      const response = await ScoreAPI.getRksList(credential);
      const newRecords = response.data.records || [];
      setRecords(newRecords);
      try {
        const ownerKey = getOwnerKey(credential as AuthCredential);
        if (ownerKey) {
          const cached = localStorage.getItem(CACHE_KEY);
          const map = (cached ? JSON.parse(cached) : {}) as Record<string, { records: RksRecord[]; ts: number }>;
          const now = Date.now();
          map[ownerKey] = { records: newRecords, ts: now };
          localStorage.setItem(CACHE_KEY, JSON.stringify(map));
        }
      } catch {}
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilterDifficulty('all');
    setSortBy('rks');
    setSortOrder('desc');

    setMinRks('');
    setMaxRks('');
    setMinAcc('');
    setMaxAcc('');
    setMinDifficultyValue('');
    setMaxDifficultyValue('');
    setMinScore('');
    setMaxScore('');
    setOnlyPositiveRks(false);
    setLimitCount('');
  };

  const hasAdvancedFilters =
    !!minRks.trim() ||
    !!maxRks.trim() ||
    !!minAcc.trim() ||
    !!maxAcc.trim() ||
    !!minDifficultyValue.trim() ||
    !!maxDifficultyValue.trim() ||
    !!minScore.trim() ||
    !!maxScore.trim() ||
    onlyPositiveRks ||
    !!limitCount.trim();

  const filteredResult = useMemo(() => {
    return filterSortLimitRksRecords(records, {
      searchQuery,
      difficulty: filterDifficulty,
      onlyPositiveRks,
      rksRange: { min: parseNumberOrNull(minRks), max: parseNumberOrNull(maxRks) },
      accRange: { min: parseNumberOrNull(minAcc), max: parseNumberOrNull(maxAcc) },
      difficultyValueRange: { min: parseNumberOrNull(minDifficultyValue), max: parseNumberOrNull(maxDifficultyValue) },
      scoreRange: { min: parseNumberOrNull(minScore), max: parseNumberOrNull(maxScore) },
      sortBy,
      sortOrder,
      limit: parseIntegerOrNull(limitCount),
    });
  }, [
    records,
    searchQuery,
    filterDifficulty,
    onlyPositiveRks,
    minRks,
    maxRks,
    minAcc,
    maxAcc,
    minDifficultyValue,
    maxDifficultyValue,
    minScore,
    maxScore,
    sortBy,
    sortOrder,
    limitCount,
  ]);

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* RKS 历史变化面板 */}
      <RksHistoryPanel showTitle={true} />

      {/* RKS 成绩列表 */}
      <section className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-6 shadow-lg">
        <div className="mb-6">
          {showTitle && (
            <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
              RKS 成绩列表
            </h2>
          )}
          {showDescription && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            查看所有歌曲的详细成绩和 RKS 计算值。
          </p>
          )}
        </div>

      {/* Filters and Search */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            搜索歌曲
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="输入歌曲名称..."
            className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            难度筛选
          </label>
          <StyledSelect
            options={[
              { label: '全部难度', value: 'all' },
              { label: 'EZ', value: 'EZ' },
              { label: 'HD', value: 'HD' },
              { label: 'IN', value: 'IN' },
              { label: 'AT', value: 'AT' },
            ]}
            value={filterDifficulty}
            onValueChange={(v: 'all' | 'EZ' | 'HD' | 'IN' | 'AT') => setFilterDifficulty(v)}
            placeholder="选择难度"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            排序字段
          </label>
          <StyledSelect
            options={[
              { label: '单曲 RKS', value: 'rks' },
              { label: '准确率', value: 'acc' },
              { label: '分数', value: 'score' },
              { label: '谱面定数', value: 'difficulty_value' },
            ]}
            value={sortBy}
            onValueChange={(v: RksSortBy) => setSortBy(v)}
            placeholder="选择排序字段"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            排序方向
          </label>
          <StyledSelect
            options={[
              { label: '降序 (高→低)', value: 'desc' },
              { label: '升序 (低→高)', value: 'asc' },
            ]}
            value={sortOrder}
            onValueChange={(v: RksSortOrder) => setSortOrder(v)}
            placeholder="选择排序方向"
          />
        </div>
      </div>

      {/* Advanced Filters */}
      <details className="mb-6 rounded-xl border border-gray-200/60 dark:border-gray-700/60 bg-white/40 dark:bg-gray-900/30 p-4">
        <summary className="cursor-pointer select-none text-sm font-medium text-gray-700 dark:text-gray-200">
          高级筛选{hasAdvancedFilters ? '（已启用）' : ''}
        </summary>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">单曲 RKS 范围</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={minRks}
                onChange={(e) => setMinRks(e.target.value)}
                placeholder="最小"
                className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={maxRks}
                onChange={(e) => setMaxRks(e.target.value)}
                placeholder="最大"
                className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">准确率范围（%）</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={minAcc}
                onChange={(e) => setMinAcc(e.target.value)}
                placeholder="最小"
                className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={maxAcc}
                onChange={(e) => setMaxAcc(e.target.value)}
                placeholder="最大"
                className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">定数范围</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={minDifficultyValue}
                onChange={(e) => setMinDifficultyValue(e.target.value)}
                placeholder="最小"
                className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={maxDifficultyValue}
                onChange={(e) => setMaxDifficultyValue(e.target.value)}
                placeholder="最大"
                className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">分数范围</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                placeholder="最小"
                className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                placeholder="最大"
                className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">仅显示前 N 条</label>
            <input
              type="text"
              value={limitCount}
              onChange={(e) => setLimitCount(e.target.value)}
              placeholder="留空表示不限制"
              className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">其他</label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={onlyPositiveRks}
                  onChange={(e) => setOnlyPositiveRks(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500"
                />
                只看 RKS &gt; 0
              </label>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                重置筛选
              </button>
            </div>
          </div>
        </div>
      </details>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

{isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <RotatingTips />
        </div>
      ) : filteredResult.records.length > 0 ? (
        <div className="space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            显示 {filteredResult.records.length} 条记录{filteredResult.totalMatched !== filteredResult.records.length ? `（匹配 ${filteredResult.totalMatched} 条）` : ''}
          </div>

          {/* Mobile: Card list */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredResult.records.map((record, index) => (
              <ScoreCard
                key={`${record.song_name}|${record.difficulty}|${record.difficulty_value}|${record.score}`}
                record={record}
                rank={index + 1}
                nameMaxLines={2}
              />
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    排名
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    歌曲名称
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    难度
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    定数
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    分数
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    准确率
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    单曲RKS
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredResult.records.map((record, index) => (
                  <tr
                    key={`${record.song_name}|${record.difficulty}|${record.difficulty_value}|${record.score}`}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      #{index + 1}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {record.song_name}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${DIFFICULTY_BG[record.difficulty]} ${DIFFICULTY_TEXT[record.difficulty]}`}
                      >
                        {record.difficulty}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-gray-700 dark:text-gray-300">
                      {record.difficulty_value.toFixed(1)}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-gray-700 dark:text-gray-300">
                      {record.score.toLocaleString('zh-CN')}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-gray-700 dark:text-gray-300">
                      {record.acc.toFixed(2)}%
                    </td>
                    <td className="py-3 px-4 text-center text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {record.rks.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          {records.length === 0 ? '暂无成绩记录' : '没有符合条件的记录'}
        </div>
      )}
      </section>
    </div>
  );
}

// 避免无关状态（如移动端菜单开关）导致重渲染
export const RksRecordsList = React.memo(RksRecordsListInner);
