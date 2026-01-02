'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import Link from 'next/link';

import { ThemeToggle } from '../../components/ThemeToggle';
import { useAuth } from '../../contexts/AuthContext';
import { THEME_NAME_DESKTOP, THEME_NAME_MOBILE } from '../../lib/constants/themeNames';

export type UnifiedApiSectionId = 'bind' | 'accounts' | 'tools';

interface Section {
  id: UnifiedApiSectionId;
  name: string;
  icon: React.ReactNode;
  description: string;
}

interface UnifiedApiSidebarProps {
  activeSection?: UnifiedApiSectionId | null;
  onSectionChange?: (sectionId: UnifiedApiSectionId) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function UnifiedApiSidebar({
  activeSection,
  onSectionChange,
  isMobileOpen = false,
  onMobileClose,
}: UnifiedApiSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { logout, credential } = useAuth();
  const { theme, resolvedTheme } = useTheme();
  const effectiveTheme = (theme === 'system' ? resolvedTheme : theme) as 'light' | 'dark' | undefined;

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

  const sections: Section[] = [
    {
      id: 'bind',
      name: '绑定',
      description: '完成账号绑定与凭证配置',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-1.414 1.414a4 4 0 105.656 5.656l1.414-1.414m-2.828-2.828a4 4 0 005.656 0l1.414-1.414a4 4 0 10-5.656-5.656l-1.414 1.414"
          />
        </svg>
      ),
    },
    {
      id: 'accounts',
      name: '账号',
      description: '查看与管理已绑定账号',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 14a4 4 0 10-8 0m8 0a4 4 0 01-8 0m8 0v1a3 3 0 01-3 3H11a3 3 0 01-3-3v-1m12-6a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
    },
    {
      id: 'tools',
      name: '查询工具',
      description: '榜单/单曲排名/用户查询等',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
  ];

  const handleSectionChange = (sectionId: UnifiedApiSectionId) => {
    onSectionChange?.(sectionId);
    onMobileClose?.();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`w-72 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col transform-gpu will-change-transform
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 lg:z-auto`}
        style={{ width: isCollapsed ? 80 : 288 }}
      >
        {/* Sidebar Header */}
        <div className={`h-16 border-b border-gray-200 dark:border-gray-700 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-4`}>
          {!isCollapsed && (
            <span className="font-semibold text-lg">联合API 菜单</span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            <svg
              className={`w-5 h-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Sections */}
        <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => handleSectionChange(section.id)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : ''} gap-3 px-3 py-3 rounded-lg transition-all ${
                activeSection === section.id
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={isCollapsed ? section.name : undefined}
            >
              <div className={`flex-shrink-0 ${activeSection === section.id ? 'text-white' : ''}`}>
                {section.icon}
              </div>
              {!isCollapsed && (
                <div className="flex-1 text-left">
                  <div className="font-medium">{section.name}</div>
                  <div
                    className={`text-xs mt-0.5 ${
                      activeSection === section.id ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {section.description}
                  </div>
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Mobile: User Info & Actions（桌面端在 Header） */}
        <div className="border-t border-gray-200 dark:border-gray-700 lg:hidden">
          {!isCollapsed ? (
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                <svg className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="8" />
                </svg>
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                  {getCredentialDisplay()}
                </span>
              </div>

              <div className="space-y-1">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                  </svg>
                  个人仪表盘
                </Link>

                <Link
                  href="/about"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  关于
                </Link>

                <Link
                  href="/contribute"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  投稿
                </Link>

                <Link
                  href="/debug-auth"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  调试页面
                </Link>

                <div className="flex items-center px-3 py-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">主题</span>
                  <span className="ml-2 min-w-0 text-xs text-gray-500 dark:text-gray-400 select-none" aria-hidden="true">
                    <span className="hidden min-[360px]:inline">{effectiveTheme ? THEME_NAME_DESKTOP[effectiveTheme] : ''}</span>
                    <span className="hidden min-[320px]:inline min-[360px]:hidden">{effectiveTheme ? THEME_NAME_MOBILE[effectiveTheme] : ''}</span>
                  </span>
                  <div className="ml-auto">
                    <ThemeToggle />
                  </div>
                </div>

                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  退出登录
                </button>
              </div>

              <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                  <p>联合API 仪表盘</p>
                  <p>v1.0.0</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              <Link
                href="/dashboard"
                className="w-full flex items-center justify-center px-3 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="个人仪表盘"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                </svg>
              </Link>

              <Link
                href="/about"
                className="w-full flex items-center justify-center px-3 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="关于"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </Link>

              <Link
                href="/contribute"
                className="w-full flex items-center justify-center px-3 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="投稿"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </Link>

              <button
                onClick={logout}
                className="w-full flex items-center justify-center px-3 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="退出登录"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

