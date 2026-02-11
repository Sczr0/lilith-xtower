'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import {
  runWhenIdle,
  shouldPreload,
  getPreloadPolicy,
  preconnect,
  dnsPrefetch,
  prefetchLeaderboard,
  prefetchServiceStats,
} from '../lib/utils/preload';
import { LEADERBOARD_TOP_LIMIT_DEFAULT } from '../lib/constants/leaderboard';

/**
 * 预加载链接组件
 * 在首页加载时预取关键路由和资源
 */
export function PreloadLinks() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!shouldPreload()) return;

    const policy = getPreloadPolicy();
    const prefetchedRoutes = new Set<string>();
    const prefetchRoute = (path: string) => {
      if (prefetchedRoutes.has(path)) return;
      prefetchedRoutes.add(path);
      void router.prefetch(path);
    };

    runWhenIdle(() => {
      // 预连接到 TapTap API 域名
      preconnect('https://accounts.tapapis.cn');
      preconnect('https://accounts.tapapis.com');
      dnsPrefetch('//accounts.tapapis.cn');
      dnsPrefetch('//accounts.tapapis.com');

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
        prefetchLeaderboard(LEADERBOARD_TOP_LIMIT_DEFAULT);
        // 预取服务统计
        prefetchServiceStats();
      }
    }, policy.homeIdleTimeout);
  }, [isAuthenticated, router]);

  // 此组件不渲染任何内容
  return null;
}
