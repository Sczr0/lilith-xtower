'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ScoreAPI } from '../lib/api/score';
import { RksRecord } from '../lib/types/score';
import { DIFFICULTY_BG, DIFFICULTY_TEXT } from '../lib/constants/difficultyColors';

export function RksRecordsList() {
  const { credential } = useAuth();
  const [records, setRecords] = useState<RksRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'rks' | 'acc'>('rks');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (credential) {
      loadRecords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credential]);

  const loadRecords = async () => {
    if (!credential) {
      setError('未找到登录凭证，请重新登录。');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await ScoreAPI.getRksList(credential);
      setRecords(response.data.records);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRecords = records
    .filter((record) => {
      if (filterDifficulty !== 'all' && record.difficulty !== filterDifficulty) {
        return false;
      }
      if (searchQuery.trim() && !record.song_name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'rks') {
        return b.rks - a.rks;
      }
      return b.acc - a.acc;
    });

  return (
    <section className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-6 shadow-lg w-full max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
          RKS 成绩列表
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          查看所有歌曲的详细成绩和 RKS 计算值。
        </p>
      </div>

      {/* Filters and Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            搜索歌曲
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="输入歌曲名称..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            难度筛选
          </label>
          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部难度</option>
            <option value="EZ">EZ</option>
            <option value="HD">HD</option>
            <option value="IN">IN</option>
            <option value="AT">AT</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            排序方式
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'rks' | 'acc')}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="rks">按 RKS 排序</option>
            <option value="acc">按准确率排序</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredRecords.length > 0 ? (
        <div className="space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            共 {filteredRecords.length} 条记录
          </div>
          <div className="overflow-x-auto">
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
                    准确率
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    RKS
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record, index) => (
                  <tr
                    key={`${record.song_name}-${record.difficulty}-${index}`}
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
  );
}
