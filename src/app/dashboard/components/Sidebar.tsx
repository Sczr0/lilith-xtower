'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '../../contexts/AuthContext';
import { ThemeToggle } from '../../components/ThemeToggle';
import Link from 'next/link';
import { THEME_NAME_MOBILE, THEME_NAME_DESKTOP } from '../../lib/constants/themeNames';

export type TabId = 'best-n' | 'single-query' | 'rks-list' | 'leaderboard' | 'song-updates' | 'player-score-render' | 'stats';

interface Tab {
  id: TabId;
  name: string;
  icon: React.ReactNode;
  description: string;
}

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  onOpenAnnouncements?: () => void;
}

export function Sidebar({ activeTab, onTabChange, isMobileOpen = false, onMobileClose, onOpenAnnouncements }: SidebarProps) {
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

  const tabs: Tab[] = [
    {
      id: 'best-n',
      name: 'Best N 图片',
      description: '生成成绩图片',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'single-query',
      name: '单曲查询',
      description: '查询歌曲详情',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      id: 'rks-list',
      name: 'RKS 列表',
      description: 'RKS 计算详情',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      id: 'leaderboard',
      name: '排行榜',
      description: '全站排名与档案',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6m6 6V5M5 21h14M13 13l2-2m0 0l2 2m-2-2v8" />
        </svg>
      ),
    },
    {
      id: 'song-updates',
      name: '新曲速递',
      description: '最新曲目更新',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      ),
    },
    {
      id: 'player-score-render',
      name: '玩家成绩渲染',
      description: '自定义成绩展示',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
    },
    {
      id: 'stats',
      name: '服务统计',
      description: '使用情况统计',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  const handleTabChange = (tabId: TabId) => {
    onTabChange(tabId);
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          isCollapsed ? 'w-20' : 'w-64'
        } bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col transform-gpu will-change-transform
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 lg:z-auto`}
      >
      {/* Sidebar Header */}
      <div className={`h-16 border-b border-gray-200 dark:border-gray-700 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-4`}>
        {!isCollapsed && (
          <span className="font-semibold text-lg">功能菜单</span>
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

      {/* Tabs */}
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : ''} gap-3 px-3 py-3 rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={isCollapsed ? tab.name : undefined}
          >
            <div className={`flex-shrink-0 ${activeTab === tab.id ? 'text-white' : ''}`}>
              {tab.icon}
            </div>
            {!isCollapsed && (
              <div className="flex-1 text-left">
                <div className="font-medium">{tab.name}</div>
                <div className={`text-xs mt-0.5 ${
                  activeTab === tab.id ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {tab.description}
                </div>
              </div>
            )}
          </button>
        ))}
      </nav>

      {/* User Info & Actions - only on mobile (desktop见Header) */}
      <div className="border-t border-gray-200 dark:border-gray-700 lg:hidden">
        {!isCollapsed ? (
          <div className="p-3 space-y-2">
            {/* User Status */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="8" />
              </svg>
              <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                {getCredentialDisplay()}
              </span>
            </div>

            {/* Action Links */}
            <div className="space-y-1">
              <button
                onClick={() => { onOpenAnnouncements?.(); onMobileClose?.(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5l8-2v18l-8-2M3 10h5v4H3z" />
                </svg>
                公告
              </button>
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
                  {/* 宽度>=360px 显示完整标题；>=320且<360显示短标题；<320不展示 */}
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

            {/* Version Info */}
            <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                <p>Phigros 查询工具</p>
                <p>v1.0.0</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {/* Collapsed - Only show icons */}
            <button
              onClick={() => { onOpenAnnouncements?.(); onMobileClose?.(); }}
              className="w-full flex items-center justify-center px-3 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="公告"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5l8-2v18l-8-2M3 10h5v4H3z" />
              </svg>
            </button>
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
