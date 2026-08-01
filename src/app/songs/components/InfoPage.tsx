'use client';

import { useState } from 'react';
import { ListMusic, Table2, Info } from 'lucide-react';

import type { SongInfoData } from '@/app/lib/info/csv';
import { cardStyles } from '../../components/ui/styles';
import { ChartLevelsTable } from './ChartLevelsTable';
import { SongInfoTable } from './SongInfoTable';
import { VersionPanel } from './VersionPanel';

type InfoTabId = 'levels' | 'songs' | 'version';

const TABS: { id: InfoTabId; label: string; icon: typeof ListMusic }[] = [
  { id: 'levels', label: '定数表', icon: Table2 },
  { id: 'songs', label: '曲目信息', icon: ListMusic },
  { id: 'version', label: '版本信息', icon: Info },
];

export function InfoPage({
  initialData,
  initialError,
}: {
  initialData: SongInfoData | null;
  initialError: string | null;
}) {
  const [activeTab, setActiveTab] = useState<InfoTabId>('levels');

  return (
    <div className="space-y-4">
      {/* 页头 */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">曲目信息</h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Phigros 全曲目定数与基础信息。
        </p>
        {initialData && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            当前收录版本 {initialData.version}
            {initialData.build != null ? ` (${initialData.build})` : ''} · 共 {initialData.songs.length} 首曲目
          </p>
        )}
      </div>

      {/* Tab 切换 */}
      <div
        role="tablist"
        aria-label="曲目信息分类"
        className="flex gap-1 rounded-xl bg-gray-100 dark:bg-neutral-800/60 p-1 w-fit mx-auto"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={active}
              aria-controls={`info-panel-${tab.id}`}
              id={`info-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 sm:px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 内容 */}
      {initialError && (
        <div
          className={cardStyles({
            className:
              'max-w-2xl mx-auto text-center p-6 border-red-300/60 dark:border-red-800/60 bg-red-50/60 dark:bg-red-950/20',
          })}
          role="alert"
        >
          <p className="font-medium mb-1">曲目信息暂不可用</p>
          <p className="text-sm opacity-80 break-all">{initialError}</p>
          <p className="text-xs mt-3 opacity-70">请稍后刷新重试。</p>
        </div>
      )}

      {initialData && (
        <div
          id={`info-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`info-tab-${activeTab}`}
          className="space-y-4"
        >
          {activeTab === 'levels' && <ChartLevelsTable songs={initialData.songs} />}
          {activeTab === 'songs' && <SongInfoTable songs={initialData.songs} />}
          {activeTab === 'version' && <VersionPanel data={initialData} />}
        </div>
      )}
    </div>
  );
}
