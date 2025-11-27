'use client';

import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../contexts/AuthContext';

/**
 * 首页 Header 组件
 * 客户端组件，处理认证状态显示
 */
export function HomeHeader() {
  const { isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 lg:px-6 flex items-center">
      <Link href="/" className="text-base font-semibold">Phigros 查询</Link>
      <nav className="ml-auto flex items-center gap-4">
        <Link href="/sponsors" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">赞助者</Link>
        <Link href="/qa" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">常见问题</Link>
        <Link href="/contribute" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">投稿</Link>
        {!isAuthenticated && (
          <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">登录</Link>
        )}
        <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">控制台</Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}