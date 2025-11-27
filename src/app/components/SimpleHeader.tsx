import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

interface SimpleHeaderProps {
  showLogin?: boolean;
}

/**
 * 简化版 Header 组件
 * 不依赖 AuthContext，适用于 SSG/SSR 页面
 * 登录状态由客户端 hydration 后处理
 */
export function SimpleHeader({ showLogin = true }: SimpleHeaderProps) {
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 lg:px-6 flex items-center">
      <Link href="/" className="text-base font-semibold text-gray-900 dark:text-gray-50">
        Phigros 查询
      </Link>
      <nav className="ml-auto flex items-center gap-4">
        <Link
          href="/about"
          className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
        >
          关于
        </Link>
        <Link
          href="/qa"
          className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
        >
          常见问题
        </Link>
        {showLogin && (
          <Link
            href="/login"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            登录
          </Link>
        )}
        <Link
          href="/dashboard"
          className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
        >
          仪表盘
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}