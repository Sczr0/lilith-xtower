'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import {
  getHomePreloadIdleTimeout,
  runWhenIdleLite,
  shouldPreloadLite,
} from '../lib/utils/preload-gate';
import { LEADERBOARD_TOP_LIMIT_DEFAULT } from '../lib/constants/leaderboard';

/**
 * 预加载链接组件
 * 在首页加载时预取关键路由和资源
 */
export function PreloadLinks() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!shouldPreloadLite()) return;
    const prefetchedRoutes = new Set<string>();
    const prefetchRoute = (path: string) => {
      if (prefetchedRoutes.has(path)) return;
      prefetchedRoutes.add(path);
      void router.prefetch(path);
    };
    let cancelled = false;

    runWhenIdleLite(() => {
      // 说明：重型预加载模块改为按需加载，避免进入首页首屏共享包。
      void import('../lib/utils/preload')
        .then((mod) => {
          if (cancelled) return;

          const policy = mod.getPreloadPolicy();

          // 预连接到 TapTap API 域名
          mod.preconnect('https://accounts.tapapis.cn');
          mod.preconnect('https://accounts.tapapis.com');
          mod.dnsPrefetch('//accounts.tapapis.cn');
          mod.dnsPrefetch('//accounts.tapapis.com');

          // 预取登录页面（未登录用户最可能访问）
          if (!isAuthenticated) {
            prefetchRoute('/login');
          }

          // 预取常用页面
          policy.homePublicRoutes.forEach(prefetchRoute);

          // 如果已登录，预取 dashboard 和相关数据
          if (isAuthenticated) {
            policy.homeAuthenticatedRoutes.forEach(prefetchRoute);
            // 预取排行榜数据
            void mod.prefetchLeaderboard(LEADERBOARD_TOP_LIMIT_DEFAULT);
            // 预取服务统计
            void mod.prefetchServiceStats();
          }
        })
        .catch(() => {
          // 预加载失败不影响主流程
        });
    }, getHomePreloadIdleTimeout());

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, router]);

  // 此组件不渲染任何内容
  return null;
}
