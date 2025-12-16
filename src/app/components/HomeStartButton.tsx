'use client';

import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';

interface HomeStartButtonProps {
  className?: string;
}

export function getHomeStartHref(isAuthenticated: boolean) {
  return isAuthenticated ? '/dashboard' : '/login';
}

/**
 * 首页“立即开始”按钮：
 * - 已登录：直达仪表盘
 * - 未登录：进入登录页
 */
export function HomeStartButton({ className }: HomeStartButtonProps) {
  const { isAuthenticated } = useAuth();

  return (
    <Link href={getHomeStartHref(isAuthenticated)} className={className}>
      立即开始
    </Link>
  );
}
