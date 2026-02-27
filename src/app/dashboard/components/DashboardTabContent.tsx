'use client';

import dynamic from 'next/dynamic';

import type { SongUpdate } from '../../lib/types/content';
import type { TabId } from './Sidebar';
import { ServiceStats } from '../../components/ServiceStats';

function PanelSkeleton(props: { rows?: number }) {
  const rows = props.rows ?? 5;
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm animate-pulse">
      <div className="h-5 w-40 bg-gray-200 dark:bg-gray-800 rounded mb-4" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="h-4 bg-gray-200 dark:bg-gray-800 rounded" style={{ width: `${80 - idx * 7}%` }} />
        ))}
      </div>
    </div>
  );
}

function SongUpdateListSkeleton() {
  const items = Array.from({ length: 3 });
  return (
    <div className="space-y-5">
      {items.map((_, idx) => (
        <div
          key={idx}
          className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden animate-pulse"
        >
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="h-5 w-40 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
          <div className="px-5 py-4 space-y-2">
            <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// 按需动态加载各功能组件，避免首屏加载与执行过多 JS
const BnImageGenerator = dynamic(() => import('../../components/BnImageGenerator').then((m) => m.BnImageGenerator), {
  ssr: false,
  loading: () => <PanelSkeleton rows={6} />,
});
const SongSearchGenerator = dynamic(() => import('../../components/SongSearchGenerator').then((m) => m.SongSearchGenerator), {
  ssr: false,
  loading: () => <PanelSkeleton rows={6} />,
});
const RksRecordsList = dynamic(() => import('../../components/RksRecordsList').then((m) => m.RksRecordsList), {
  ssr: false,
  loading: () => <PanelSkeleton rows={8} />,
});
const SongUpdateList = dynamic(() => import('../../components/SongUpdateCard').then((m) => m.SongUpdateList), {
  ssr: false,
  loading: () => <SongUpdateListSkeleton />,
});
const PlayerScoreRenderer = dynamic(() => import('../../components/PlayerScoreRenderer').then((m) => m.PlayerScoreRenderer), {
  ssr: false,
  loading: () => <PanelSkeleton rows={8} />,
});
const LeaderboardPanel = dynamic(() => import('../../components/LeaderboardPanel').then((m) => m.LeaderboardPanel), {
  ssr: false,
  loading: () => <PanelSkeleton rows={10} />,
});
const LilithLabsPanel = dynamic(() => import('../../components/LilithLabsPanel').then((m) => m.LilithLabsPanel), {
  ssr: false,
  loading: () => <PanelSkeleton rows={8} />,
});

type DashboardTabContentProps = {
  activeTab: TabId;
  debugExport: boolean;
  songUpdates: SongUpdate[];
  songUpdatesStatus: 'idle' | 'loading' | 'success' | 'error';
  songUpdatesError: string | null;
  onRetrySongUpdates: () => void;
};

export function DashboardTabContent({
  activeTab,
  debugExport,
  songUpdates,
  songUpdatesStatus,
  songUpdatesError,
  onRetrySongUpdates,
}: DashboardTabContentProps) {
  switch (activeTab) {
    case 'best-n':
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Best N 成绩图片生成</h2>
            <p className="text-gray-600 dark:text-gray-400">生成您的最佳 N 首歌曲成绩汇总图片，支持自定义主题和数量。</p>
          </div>
          <BnImageGenerator showTitle={false} showDescription={false} format="svg" debugExport={debugExport} />
        </div>
      );
    case 'single-query':
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">单曲成绩查询</h2>
            <p className="text-gray-600 dark:text-gray-400">查询特定歌曲的详细成绩信息。</p>
          </div>
          <SongSearchGenerator showTitle={false} showDescription={false} />
        </div>
      );
    case 'rks-list':
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">RKS 成绩列表</h2>
            <p className="text-gray-600 dark:text-gray-400">查看所有歌曲的 RKS 计算详情和排名。</p>
          </div>
          <RksRecordsList showTitle={false} showDescription={false} />
        </div>
      );
    case 'song-updates':
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">新曲速递</h2>
            <p className="text-gray-600 dark:text-gray-400">查看最新的曲目更新信息和难度定数。</p>
          </div>
          <SongUpdateList
            updates={songUpdates}
            isLoading={songUpdatesStatus === 'loading' || songUpdatesStatus === 'idle'}
            error={songUpdatesError}
            onRetry={onRetrySongUpdates}
          />
        </div>
      );
    case 'leaderboard':
      return <LeaderboardPanel />;
    case 'player-score-render':
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">玩家成绩渲染</h2>
            <p className="text-gray-600 dark:text-gray-400">手动添加成绩并生成 Best N 图片，适用于自定义成绩展示。</p>
          </div>
          <PlayerScoreRenderer />
        </div>
      );
    case 'labs-lilith':
      return <LilithLabsPanel />;
    case 'stats':
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">服务统计</h2>
            <p className="text-gray-600 dark:text-gray-400">查看服务使用情况和统计数据。</p>
          </div>
          <ServiceStats showTitle={false} showDescription={false} />
        </div>
      );
    default:
      return null;
  }
}
