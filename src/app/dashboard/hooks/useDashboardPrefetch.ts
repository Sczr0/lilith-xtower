'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import {
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
 * /dashboard 预取与预热策略（集中管理，便于后续观测与分端降级）
 *
 * 说明：
 * - 这里只做“调度与缓存命中判断”，不做业务渲染；
 * - 具体“是否该预取”由 shouldPreload 统一控制（省流/弱网偏好）。
 */
export function useDashboardPrefetch({ isAuthenticated, activeTab }: { isAuthenticated: boolean; activeTab: TabId }) {
  const router = useRouter();

  // 分阶段预加载策略：
  // 阶段1（立即）：预热当前 Tab 相关组件
  // 阶段2（500ms后）：预热其他 Tab 组件
  // 阶段3（1500ms后）：预取 API 数据
  // 阶段4（3000ms后）：预取其他页面
  useEffect(() => {
    if (typeof window === 'undefined' || !shouldPreload()) return;

    // 阶段1：立即预热当前 Tab 相关组件
    runWhenIdle(() => {
      switch (activeTab) {
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
        case 'stats':
          import('../../components/ServiceStats');
          break;
        default:
          break;
      }
    }, 100);

    // 阶段2：500ms 后预热其他 Tab 组件
    const stage2Timer = window.setTimeout(() => {
      runWhenIdle(() => {
        // 按使用频率排序预加载
        import('../../components/RksRecordsList'); // RKS 列表 - 常用
        import('../../components/SongSearchGenerator'); // 单曲查询 - 常用
        import('../../components/LeaderboardPanel'); // 排行榜 - 常用
        import('../../components/SongUpdateCard'); // 新曲速递 - 较少用
        import('../../components/PlayerScoreRenderer'); // 玩家成绩渲染 - 较少用
        import('../../components/ServiceStats'); // 服务统计 - 较少用
      });
    }, 500);

    // 阶段3：1500ms 后预取 API 数据
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
    }, 1500);

    // 阶段4：3000ms 后预取其他页面
    const stage4Timer = window.setTimeout(() => {
      runWhenIdle(() => {
        // 预取用户可能访问的其他页面
        void router.prefetch('/about');
        void router.prefetch('/qa');
        void router.prefetch('/sponsors');
        void router.prefetch('/privacy');
        void router.prefetch('/agreement');
      });
    }, 3000);

    return () => {
      window.clearTimeout(stage2Timer);
      window.clearTimeout(stage3Timer);
      window.clearTimeout(stage4Timer);
    };
  }, [activeTab, isAuthenticated, router]);
}
