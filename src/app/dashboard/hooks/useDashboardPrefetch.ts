'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import {
  getPreloadPolicy,
  getPrefetchedData,
  prefetchLeaderboard,
  prefetchRksData,
  prefetchServiceStats,
  runWhenIdle,
  shouldPreload,
} from '../../lib/utils/preload';
import { LEADERBOARD_TOP_LIMIT_DEFAULT } from '../../lib/constants/leaderboard';
import type { TabId } from '../components/Sidebar';

/**
 * 按预期使用频率排序：阶段 2 只预热「下一个最可能的 tab」，
 * 而不是一次性 import 全部重型组件——后者会在首屏之后与主线程抢带宽/解析，
 * 抵消 DashboardTabContent 的按需加载。
 */
const TAB_PREHEAT_PRIORITY: readonly TabId[] = [
  'best-n',
  'rks-list',
  'single-query',
  'leaderboard',
  'song-updates',
  'player-score-render',
  'labs-lilith',
  'stats',
];

/** 按 tab 动态 import 对应面板组件（与 DashboardTabContent 的 dynamic 目标保持一致）。 */
function importTabComponent(tab: TabId): void {
  switch (tab) {
    case 'best-n':
      import('../../components/BnImageGenerator');
      break;
    case 'single-query':
      import('../../components/SongSearchGenerator');
      break;
    case 'rks-list':
      import('../../components/RksRecordsList');
      break;
    case 'leaderboard':
      import('../../components/LeaderboardPanel');
      break;
    case 'song-updates':
      import('../../components/SongUpdateCard');
      break;
    case 'player-score-render':
      import('../../components/PlayerScoreRenderer');
      break;
    case 'labs-lilith':
      import('../../components/LilithLabsPanel');
      break;
    case 'stats':
      import('../../components/ServiceStats');
      break;
    default:
      break;
  }
}

/**
 * /dashboard 预取与预热策略（集中管理，便于后续观测与分端降级）
 *
 * 说明：
 * - 这里只做“调度与缓存命中判断”，不做业务渲染；
 * - 具体“是否该预取”由 shouldPreload 统一控制（省流/弱网/低端设备会整体跳过，
 *   见 lib/utils/preload.ts 的 resolvePreloadProfile）。
 */
export function useDashboardPrefetch({ isAuthenticated, activeTab }: { isAuthenticated: boolean; activeTab: TabId }) {
  const router = useRouter();

  // 分阶段预加载策略：
  // 阶段1（立即）：预热当前 Tab 相关组件
  // 阶段2（延迟后）：只预热下一个最可能的 Tab 组件
  // 阶段3（延迟后）：预取 API 数据
  // 阶段4（延迟后）：预取其他页面
  useEffect(() => {
    if (typeof window === 'undefined' || !shouldPreload()) return;

    const policy = getPreloadPolicy();
    const prefetchedRoutes = new Set<string>();
    const prefetchRoute = (path: string) => {
      if (prefetchedRoutes.has(path)) return;
      prefetchedRoutes.add(path);
      void router.prefetch(path);
    };

    // 阶段1：立即预热当前 Tab 相关组件
    runWhenIdle(() => {
      importTabComponent(activeTab);
    }, 100);

    // 阶段2：只预热优先级最高、且非当前 Tab 的那一个组件
    const stage2Timer = window.setTimeout(() => {
      runWhenIdle(() => {
        const nextTab = TAB_PREHEAT_PRIORITY.find((tab) => tab !== activeTab);
        if (nextTab) importTabComponent(nextTab);
      });
    }, policy.dashboardStage2Delay);

    // 阶段3：预取 API 数据
    const stage3Timer = window.setTimeout(() => {
      if (!isAuthenticated) return;

      runWhenIdle(() => {
        // 预取 RKS 数据
        const rksKey = 'rks';
        if (!getPrefetchedData(rksKey)) {
          prefetchRksData();
        }

        // 预取排行榜数据
        const leaderboardKey = `leaderboard_top_${LEADERBOARD_TOP_LIMIT_DEFAULT}`;
        if (!getPrefetchedData(leaderboardKey)) {
          prefetchLeaderboard(LEADERBOARD_TOP_LIMIT_DEFAULT);
        }

        // 预取服务统计数据
        const statsKey = 'service_stats';
        if (!getPrefetchedData(statsKey)) {
          prefetchServiceStats();
        }
      });
    }, policy.dashboardStage3Delay);

    // 阶段4：预取其他页面
    const stage4Timer = window.setTimeout(() => {
      runWhenIdle(() => {
        // 预取用户可能访问的其他页面
        policy.dashboardRoutes.forEach(prefetchRoute);
      });
    }, policy.dashboardStage4Delay);

    return () => {
      window.clearTimeout(stage2Timer);
      window.clearTimeout(stage3Timer);
      window.clearTimeout(stage4Timer);
    };
  }, [activeTab, isAuthenticated, router]);
}
