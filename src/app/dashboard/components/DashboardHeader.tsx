'use client';

import { useAuth } from '../../contexts/AuthContext';
import { ThemeToggle } from '../../components/ThemeToggle';

export function DashboardHeader() {
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
      {/* Left Side - Title (Hidden on mobile, shown on desktop - mobile has hamburger menu) */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-gray-100 ml-12 lg:ml-0">
          Phigros 查询工具
        </h1>
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
        
        <a
          href="/about"
          className="hidden lg:block text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
        >
          关于
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
