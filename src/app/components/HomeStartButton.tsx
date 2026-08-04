'use client';

import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { useClientValue } from '../hooks/useClientValue';
import { AuthStorage } from '../lib/storage/auth';

interface HomeStartButtonProps {
  className?: string;
}

/**
 * 决定首页“立即开始”按钮的去向：
 * - 认证状态已加载：已登录 → 仪表盘；未登录 → 登录页
 * - 认证状态加载中：以本地登录缓存（同步可读）兜底，已缓存登录 → 直达仪表盘
 *   （会话是否有效由仪表盘守卫与服务端校验兜底），避免用户手快误入登录页再被弹回。
 */
export function getHomeStartHref(isAuthenticated: boolean, hasCachedLogin = false, isLoading = false): string {
  if (isAuthenticated || (isLoading && hasCachedLogin)) {
    return '/dashboard';
  }
  return '/login';
}

/**
 * 首页“立即开始”按钮：
 * - 已登录（或本地缓存标记已登录）：直达仪表盘
 * - 未登录：进入登录页
 */
export function HomeStartButton({ className }: HomeStartButtonProps) {
  const { isAuthenticated, isLoading } = useAuth();
  // 通过 useClientValue 读取本地登录缓存（hydration 后自动对齐客户端快照，
  // 会话状态加载完成前即可决定去向，避免误入登录页的竞态）。
  const hasCachedLogin = useClientValue(() => AuthStorage.getCachedLogin(), false);

  return (
    <Link href={getHomeStartHref(isAuthenticated, hasCachedLogin, isLoading)} className={className}>
      立即开始
    </Link>
  );
}
