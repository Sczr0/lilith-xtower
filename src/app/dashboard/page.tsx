'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sidebar, TabId } from './components/Sidebar';
import { DashboardHeader } from './components/DashboardHeader';
import { BnImageGenerator } from '../components/BnImageGenerator';
import { SongSearchGenerator } from '../components/SongSearchGenerator';
import { RksRecordsList } from '../components/RksRecordsList';
import { ServiceStats } from '../components/ServiceStats';
import { AnnouncementModal } from '../components/AnnouncementModal';
import { SongUpdateList } from '../components/SongUpdateCard';
import { PlayerScoreRenderer } from '../components/PlayerScoreRenderer';
import type { Announcement, SongUpdate } from '../lib/types/content';

export default function Dashboard() {
  const { isAuthenticated, isLoading, error } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('best-n');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [songUpdates, setSongUpdates] = useState<SongUpdate[]>([]);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 加载公告和新曲速递数据
  useEffect(() => {
    const loadContent = async () => {
      try {
        // 获取公告
        const announcementsRes = await fetch('/api/content/announcements');
        if (announcementsRes.ok) {
          const data = await announcementsRes.json();
          setAnnouncements(data);
          
          // 检查是否有未读公告
          const dismissedStr = localStorage.getItem('dismissed_announcements');
          const dismissed = dismissedStr ? new Set(JSON.parse(dismissedStr)) : new Set();
          const unread = data.filter((a: Announcement) => !dismissed.has(a.id));
          
          if (unread.length > 0) {
            setShowAllAnnouncements(false);
            setShowAnnouncements(true);
          }
        }

        // 获取新曲速递
        const updatesRes = await fetch('/api/content/song-updates');
        if (updatesRes.ok) {
          const data = await updatesRes.json();
          setSongUpdates(data);
        }
      } catch (error) {
        console.error('加载内容失败:', error);
      }
    };

    if (isAuthenticated) {
      loadContent();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'best-n':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Best N 成绩图片生成
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                生成您的最佳 N 首歌曲成绩汇总图片，支持自定义主题和数量。
              </p>
            </div>
            <BnImageGenerator />
          </div>
        );
      case 'single-query':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                单曲成绩查询
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                查询特定歌曲的详细成绩信息。
              </p>
            </div>
            <SongSearchGenerator />
          </div>
        );
      case 'rks-list':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                RKS 成绩列表
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                查看所有歌曲的 RKS 计算详情和排名。
              </p>
            </div>
            <RksRecordsList />
          </div>
        );
      case 'song-updates':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                新曲速递 🎵
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                查看最新的曲目更新信息和难度定数。
              </p>
            </div>
            <SongUpdateList updates={songUpdates} />
          </div>
        );
      case 'player-score-render':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                玩家成绩渲染
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                手动添加成绩并生成 Best N 图片，适用于自定义成绩展示。
              </p>
            </div>
            <PlayerScoreRenderer />
          </div>
        );
      case 'stats':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                服务统计
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                查看服务使用情况和统计数据。
              </p>
            </div>
            <ServiceStats />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* 公告弹窗 */}
      {showAnnouncements && announcements.length > 0 && (
        <AnnouncementModal
          announcements={announcements}
          showAll={showAllAnnouncements}
          onClose={() => setShowAnnouncements(false)}
        />
      )}

      <div className="flex h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950">
        {/* Sidebar */}
        <Sidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
          onOpenAnnouncements={() => { setShowAllAnnouncements(true); setShowAnnouncements(true); }}
        />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-30 p-2 rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700"
          aria-label="打开菜单"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Header */}
        <DashboardHeader onOpenAnnouncements={() => { setShowAllAnnouncements(true); setShowAnnouncements(true); }} />

        {/* Error Banner */}
        {error && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-6 py-3">
            <div className="max-w-6xl mx-auto flex items-center gap-3">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-yellow-800 dark:text-yellow-300">{error}</p>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            {renderContent()}
          </div>
        </main>

        {/* Footer */}
        <footer className="h-12 border-t border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm flex items-center justify-center px-3 text-center">
          {activeTab === 'best-n' || activeTab === 'single-query' ? (
            <p className="text-[13px] text-gray-500 dark:text-gray-400">
              页面与生成代码 © 2025 Phigros Query；第三方素材（如封面/标识）版权归各自权利人所有，未经许可不得用于商业用途。
            </p>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">© 2025 Phigros Query. All Rights Reserved.</p>
          )}
        </footer>
      </div>
    </div>
    </>
  );
}
