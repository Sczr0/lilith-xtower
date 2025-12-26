'use client';

import { useAuth } from '../../contexts/AuthContext';
import { ThemeToggle } from '../../components/ThemeToggle';

interface DashboardHeaderProps {
  onOpenAnnouncements?: () => void;
  onOpenMenu?: () => void;
}

export function DashboardHeader({ onOpenAnnouncements, onOpenMenu }: DashboardHeaderProps) {
  const { logout, credential } = useAuth();

  const getCredentialDisplay = () => {
    if (!credential) return '未知用户';

    switch (credential.type) {
      case 'session':
        return 'SessionToken 登录';
      case 'api':
        return 'API 凭证登录';
      case 'platform':
        return `${credential.platform} 平台`;
      default:
        return '已登录';
    }
  };

  // 维护预告已改为全局 MaintenanceNotice，不再在 Header 内展示

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 lg:px-6">
      {/* Left Side - Title with mobile menu button */}
      <div className="flex items-center gap-3">
        {/* Mobile Menu Button - Integrated into header */}
        <button
          onClick={onOpenMenu}
          className="lg:hidden p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="打开菜单"
          title="菜单"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <p className="text-lg lg:text-xl font-bold text-gray-900 dark:text-gray-100">
          Phigros 查询工具
        </p>
      </div>

      {/* Right Side - User Info (Only show on desktop, mobile uses sidebar) */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* Desktop Only - User info and actions */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="8" />
          </svg>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {getCredentialDisplay()}
          </span>
        </div>
        
        <button
          onClick={onOpenAnnouncements}
          className="hidden lg:block text-sm text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 transition-colors"
        >
          公告
        </button>

        <a
          href="/about"
          className="hidden lg:block text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
        >
          关于
        </a>

        <a
          href="/contribute"
          className="hidden lg:block text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
        >
          投稿
        </a>

        <a
          href="/unified-api"
          className="hidden lg:block text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
        >
          联合API接入
        </a>

        <a
          href="/debug-auth"
          className="hidden lg:block text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
        >
          调试
        </a>

        <button
          onClick={logout}
          className="hidden lg:block text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
        >
          退出登录
        </button>

        <div className="hidden lg:block">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
