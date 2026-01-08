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
import { formatFixedNumber, formatLocaleNumber, parseFiniteNumber } from '../lib/utils/number';
import { attachRksPushAcc } from '../lib/utils/rksPush';
import { exportTabularDataToCsv, exportTabularDataToTsv } from '../lib/utils/tabularExport';

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

// 读取 localStorage 缓存时做轻量校验，避免旧结构/污染数据导致渲染阶段崩溃
const sanitizeCachedRksRecords = (raw: unknown): RksRecord[] | null => {
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

// 支持通过 showDescription 隐藏组件内的描述，避免与外层重复
function RksRecordsListInner({ showTitle = true, showDescription = true }: { showTitle?: boolean; showDescription?: boolean }) {
  const { credential } = useAuth();
  const [records, setRecords] = useState<RksRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [lastUpdatedSource, setLastUpdatedSource] = useState<'cache' | 'network' | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
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
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          const map = parsed as Record<string, { records?: unknown; ts?: unknown }>;
          const entry = map?.[ownerKey];
          if (entry) {
            const sanitized = sanitizeCachedRksRecords(entry.records);
            if (sanitized === null) {
              // 缓存结构异常：清理该用户条目，避免后续渲染阶段崩溃
              delete map[ownerKey];
              localStorage.setItem(CACHE_KEY, JSON.stringify(map));
            } else {
              setRecords(sanitized);
              hasCachedRecords = true;
              const ts = typeof entry.ts === 'number' && Number.isFinite(entry.ts) && entry.ts > 0 ? entry.ts : null;
              if (ts !== null) {
                setLastUpdatedAt(ts);
                setLastUpdatedSource('cache');
              }

              // 若过滤后数量变化，回写清理后的缓存，避免下次再次触发
              if (Array.isArray(entry.records) && sanitized.length !== entry.records.length) {
                const ts = typeof entry.ts === 'number' && Number.isFinite(entry.ts) ? entry.ts : Date.now();
                map[ownerKey] = { records: sanitized, ts };
                localStorage.setItem(CACHE_KEY, JSON.stringify(map));
              }
            }
          }
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
      const now = Date.now();
      setLastUpdatedAt(now);
      setLastUpdatedSource('network');
      try {
        const ownerKey = getOwnerKey(credential as AuthCredential);
        if (ownerKey) {
          const cached = localStorage.getItem(CACHE_KEY);
          const map = (cached ? JSON.parse(cached) : {}) as Record<string, { records: RksRecord[]; ts: number }>;
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

  const pushAccResult = useMemo(() => attachRksPushAcc(records), [records]);
  const recordsWithPushAcc = pushAccResult.records;
  const pushLineRank = pushAccResult.pushLineRank;
  const pushLineRks = pushAccResult.pushLineRks;

  const pushAccHeaderTitle =
    pushLineRks > 0
      ? `推分ACC：达到当前推分线（Best${pushLineRank} 第${pushLineRank}位：${formatFixedNumber(pushLineRks, 4)} RKS）所需的最低准确率`
      : `推分ACC：达到当前推分线（Best${pushLineRank}）所需的最低准确率`;

  const formatPushAcc = (record: RksRecord) => {
    if (record.already_phi) {
      return { text: '已满ACC', className: 'text-gray-500 dark:text-gray-400', title: '已满ACC：该谱面准确率已达 100%' };
    }
    if (record.unreachable) {
      return { text: '不可推分', className: 'text-red-600 dark:text-red-400', title: '不可推分：即使 Phi 也达不到推分线' };
    }
    if (record.phi_only) {
      return { text: '需Phi', className: 'text-amber-600 dark:text-amber-400', title: '需Phi：只有 Phi(100%) 才能达到推分线' };
    }
    if (typeof record.push_acc === 'number' && Number.isFinite(record.push_acc)) {
      return {
        text: `${formatFixedNumber(record.push_acc, 2)}%`,
        className: 'text-emerald-700 dark:text-emerald-400',
        title: pushAccHeaderTitle,
      };
    }
    return { text: '—', className: 'text-gray-400 dark:text-gray-500', title: '已在推分线以上或推分线缺失' };
  };

  const filteredResult = useMemo(() => {
    return filterSortLimitRksRecords(recordsWithPushAcc, {
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
    recordsWithPushAcc,
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

  const formatDateTime = (ts: number) => {
    try {
      return new Date(ts).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(ts);
    }
  };

  const copyText = async (value: string, label?: string) => {
    const text = value.trim();
    if (!text) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
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

  const openSongQuery = (songName: string) => {
    if (typeof window === 'undefined') return;
    const q = songName.trim();
    if (!q) return;

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'single-query');
      url.searchParams.set('song', q);
      window.location.assign(url.toString());
    } catch {
      window.location.assign(`/dashboard?tab=single-query&song=${encodeURIComponent(q)}`);
    }
  };

  const getRecordStatus = (record: RksRecord) => {
    if (record.already_phi) return '已满ACC';
    if (record.unreachable) return '不可推分';
    if (record.phi_only) return '需Phi';
    if (typeof record.push_acc === 'number' && Number.isFinite(record.push_acc)) return '可推分';
    return '';
  };

  const buildExportData = () => {
    return {
      headers: ['排名', '歌曲', '难度', '定数', '分数', '准确率(%)', '推分ACC(%)', '单曲RKS', '状态'],
      rows: filteredResult.records.map((record, index) => [
        index + 1,
        record.song_name,
        record.difficulty,
        formatFixedNumber(record.difficulty_value, 1, ''),
        record.score,
        formatFixedNumber(record.acc, 2, ''),
        typeof record.push_acc === 'number' && Number.isFinite(record.push_acc) ? formatFixedNumber(record.push_acc, 2, '') : '',
        formatFixedNumber(record.rks, 4, ''),
        getRecordStatus(record),
      ]),
    };
  };

  const buildExportFilename = (ext: 'csv' | 'tsv') => {
    try {
      const d = new Date();
      const pad2 = (value: number) => String(value).padStart(2, '0');
      const y = d.getFullYear();
      const m = pad2(d.getMonth() + 1);
      const day = pad2(d.getDate());
      const hh = pad2(d.getHours());
      const mm = pad2(d.getMinutes());
      return `rks-records-${y}${m}${day}-${hh}${mm}.${ext}`;
    } catch {
      return `rks-records.${ext}`;
    }
  };

  const downloadTextFile = (content: string, filename: string, mime: string) => {
    try {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setCopyHint('下载失败，请稍后重试');
      window.setTimeout(() => setCopyHint(null), 1600);
    }
  };

  const handleDownloadCsv = () => {
    const data = buildExportData();
    const csv = exportTabularDataToCsv(data, { bom: true, eol: '\r\n' });
    downloadTextFile(csv, buildExportFilename('csv'), 'text/csv;charset=utf-8');
  };

  const handleDownloadExcel = () => {
    const data = buildExportData();
    const tsv = exportTabularDataToTsv(data, { bom: true, eol: '\r\n' });
    downloadTextFile(tsv, buildExportFilename('tsv'), 'text/tab-separated-values;charset=utf-8');
  };

  const handleCopyTable = async () => {
    const data = buildExportData();
    const tsv = exportTabularDataToTsv(data, { bom: false, eol: '\n' });
    await copyText(tsv, '表格');
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* RKS 历史变化面板 */}
      <RksHistoryPanel showTitle={true} />

      {/* RKS 成绩列表 */}
      <section className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-6 shadow-lg">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
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
            {lastUpdatedAt !== null && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                更新时间：{formatDateTime(lastUpdatedAt)}
                {lastUpdatedSource === 'cache' ? '（缓存）' : lastUpdatedSource === 'network' ? '（网络）' : ''}
              </p>
            )}
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!credential || isLoading}
                onClick={() => loadRecords({ showLoading: true })}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                title={!credential ? '未找到登录凭证' : undefined}
              >
                刷新
              </button>
              <button
                type="button"
                disabled={isLoading || filteredResult.records.length === 0}
                onClick={handleCopyTable}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                title="复制为 TSV，可直接粘贴到 Excel/表格"
              >
                复制表格
              </button>
              <button
                type="button"
                disabled={isLoading || filteredResult.records.length === 0}
                onClick={handleDownloadCsv}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                下载 CSV
              </button>
              <button
                type="button"
                disabled={isLoading || filteredResult.records.length === 0}
                onClick={handleDownloadExcel}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
                title="导出为 TSV（Excel 可直接打开）"
              >
                下载 Excel
              </button>
            </div>
            {copyHint && (
              <p className="text-xs text-emerald-700 dark:text-emerald-300">{copyHint}</p>
            )}
          </div>
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
              <div
                key={`${record.song_name}|${record.difficulty}|${record.difficulty_value}|${record.score}`}
                className="space-y-2"
              >
                <ScoreCard record={record} rank={index + 1} nameMaxLines={2} />
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => copyText(record.song_name, '歌名')}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  >
                    复制歌名
                  </button>
                  <button
                    type="button"
                    onClick={() => openSongQuery(record.song_name)}
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                  >
                    单曲查询
                  </button>
                </div>
              </div>
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
                  <th
                    className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300"
                    title={pushAccHeaderTitle}
                  >
                    推分ACC
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    单曲RKS
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    操作
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
                      {formatFixedNumber(record.difficulty_value, 1)}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-gray-700 dark:text-gray-300">
                      {formatLocaleNumber(record.score, 'zh-CN')}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-gray-700 dark:text-gray-300">
                      {formatFixedNumber(record.acc, 2)}%
                    </td>
                    <td className="py-3 px-4 text-center text-sm">
                      {(() => {
                        const { text, className, title } = formatPushAcc(record);
                        return (
                          <span className={className} title={title}>
                            {text}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4 text-center text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {formatFixedNumber(record.rks, 4)}
                    </td>
                    <td className="py-3 px-4 text-center text-sm">
                      <div className="inline-flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyText(record.song_name, '歌名')}
                          className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50 px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                        >
                          复制
                        </button>
                        <button
                          type="button"
                          onClick={() => openSongQuery(record.song_name)}
                          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
                        >
                          查询
                        </button>
                      </div>
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
