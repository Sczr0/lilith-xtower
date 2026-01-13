'use client';

import { useCallback, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sidebar, TabId } from './components/Sidebar';
import { DashboardHeader } from './components/DashboardHeader';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnnouncementModal } from '../components/AnnouncementModal';
import { MenuGuide } from './components/MenuGuide';
import { getPrefetchedData, prefetchRksData, prefetchLeaderboard, prefetchServiceStats, runWhenIdle, shouldPreload } from '../lib/utils/preload';
import { LEADERBOARD_TOP_LIMIT_DEFAULT } from '../lib/constants/leaderboard';
import type { Announcement, SongUpdate } from '../lib/types/content';
import { RotatingTips } from '../components/RotatingTips';
import { DashboardTabContent } from './components/DashboardTabContent';
const AGREEMENT_KEY = 'phigros_agreement_accepted';

const isTabId = (value: string): value is TabId =>
  value === 'best-n' ||
  value === 'single-query' ||
  value === 'rks-list' ||
  value === 'leaderboard' ||
  value === 'song-updates' ||
  value === 'player-score-render' ||
  value === 'stats';

const parseDebugExport = (value: string | null): boolean => value === '1' || value === 'true';

export default function Dashboard() {
  const { isAuthenticated, isLoading, error } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // 说明：tab 与 debug 以 URL 查询参数为单一来源，避免组件内再做“硬刷新”同步。
  const tabParam = searchParams.get('tab');
  const activeTab: TabId = tabParam && isTabId(tabParam) ? tabParam : 'best-n';
  const debugExport = parseDebugExport(searchParams.get('debug'));
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [songUpdates, setSongUpdates] = useState<SongUpdate[]>([]);
  const [songUpdatesStatus, setSongUpdatesStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [songUpdatesError, setSongUpdatesError] = useState<string | null>(null);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // 仅在用户已同意用户协议后，才显示首次使用提醒与公告，避免与协议弹窗叠加造成混乱
  const [showMenuGuide, setShowMenuGuide] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem(AGREEMENT_KEY) === 'true'; } catch { return false; }
  });

  const handleTabChange = useCallback((tabId: TabId) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', tabId);
    router.replace(`/dashboard?${next.toString()}`, { scroll: false });
  }, [router, searchParams]);

  // 预取关键数据（如果尚未预取）

  // 分阶段预加载策略：
  // 阶段1（立即）：预热当前 Tab 相关组件
  // 阶段2（500ms后）：预热其他 Tab 组件
  // 阶段3（1500ms后）：预取 API 数据
  // 阶段4（3000ms后）：预取其他页面
  useEffect(() => {
    if (typeof window === 'undefined' || !shouldPreload()) return;

    // 阶段1：立即预热当前 Tab（best-n）相关组件
    runWhenIdle(() => {
      import('../components/BnImageGenerator');
    }, 100);

    // 阶段2：500ms 后预热其他 Tab 组件
    const stage2Timer = setTimeout(() => {
      runWhenIdle(() => {
        // 按使用频率排序预加载
        import('../components/RksRecordsList');      // RKS 列表 - 常用
        import('../components/SongSearchGenerator'); // 单曲查询 - 常用
        import('../components/LeaderboardPanel');    // 排行榜 - 常用
        import('../components/SongUpdateCard');      // 新曲速递 - 较少用
        import('../components/PlayerScoreRenderer'); // 玩家成绩渲染 - 较少用
      });
    }, 500);

    // 阶段3：1500ms 后预取 API 数据
    const stage3Timer = setTimeout(() => {
      if (!isAuthenticated) return;
      
      runWhenIdle(() => {
        // 预取 RKS 数据
        const rksKey = 'rks';
        if (!getPrefetchedData(rksKey)) {
          prefetchRksData();
        }

        // 预取排行榜数据
        const leaderboardKey = `leaderboard_top_${LEADERBOARD_TOP_LIMIT_DEFAULT}`;
        if (!getPrefetchedData(leaderboardKey)) {
          prefetchLeaderboard(LEADERBOARD_TOP_LIMIT_DEFAULT);
        }

        // 预取服务统计数据
        const statsKey = 'service_stats';
        if (!getPrefetchedData(statsKey)) {
          prefetchServiceStats();
        }
      });
    }, 1500);

    // 阶段4：3000ms 后预取其他页面
    const stage4Timer = setTimeout(() => {
      runWhenIdle(() => {
        // 预取用户可能访问的其他页面
        void router.prefetch('/about');
        void router.prefetch('/qa');
        void router.prefetch('/sponsors');
        void router.prefetch('/privacy');
        void router.prefetch('/agreement');
      });
    }, 3000);

    return () => {
      clearTimeout(stage2Timer);
      clearTimeout(stage3Timer);
      clearTimeout(stage4Timer);
    };
  }, [isAuthenticated, router]);

  useEffect(() => {
    // 与 AuthContext 中的 AGREEMENT_KEY 保持一致
    const AGREEMENT_KEY = 'phigros_agreement_accepted';
    try {
      const accepted = typeof window !== 'undefined' && localStorage.getItem(AGREEMENT_KEY) === 'true';
      setAgreementAccepted(!!accepted);
      // 只有在已同意用户协议后，才允许显示首次使用提醒
      setShowMenuGuide(!!accepted);
    } catch {}
  }, [isAuthenticated]);

  const loadSongUpdates = useCallback(async (signal?: AbortSignal) => {
    setSongUpdatesStatus('loading');
    setSongUpdatesError(null);

    try {
      const updatesRes = await fetch('/api/content/song-updates', { signal });
      if (!updatesRes.ok) {
        setSongUpdatesStatus('error');
        setSongUpdatesError('新曲速递加载失败，请稍后重试。');
        return;
      }

      const data = await updatesRes.json();
      setSongUpdates(data);
      setSongUpdatesStatus('success');
    } catch (err) {
      if (signal?.aborted) return;
      const message = err instanceof Error ? err.message : 'unknown error';
      if (/aborted|aborterror/i.test(message)) return;

      setSongUpdatesStatus('error');
      setSongUpdatesError('新曲速递加载失败，请检查网络后重试。');
    }
  }, []);

  // 当已同意协议且存在未读公告时，触发展示
  useEffect(() => {
    if (!agreementAccepted || announcements.length === 0) return;
    try {
      const dismissedStr = localStorage.getItem('dismissed_announcements');
      const dismissed = dismissedStr ? new Set<string>(JSON.parse(dismissedStr)) : new Set<string>();
      const unread = announcements.filter((a: Announcement) => !dismissed.has(a.id));
      if (unread.length > 0) {
        setShowAllAnnouncements(false);
        setShowAnnouncements(true);
      }
    } catch {}
  }, [agreementAccepted, announcements]);

  // 加载公告数据
  useEffect(() => {
    if (!isAuthenticated) return;

    const controller = new AbortController();
    const { signal } = controller;
    const loadContent = async () => {
      try {
        // 获取公告
        const announcementsRes = await fetch('/api/content/announcements', { signal });
        if (announcementsRes.ok) {
          const data = await announcementsRes.json();
          setAnnouncements(data);
          
          // 检查是否有未读公告
          const dismissedStr = localStorage.getItem('dismissed_announcements');
          const dismissed = dismissedStr ? new Set(JSON.parse(dismissedStr)) : new Set();
          const unread = data.filter((a: Announcement) => !dismissed.has(a.id));
          
          // 仅当已同意用户协议时才展示公告，避免与协议弹窗叠加
          if (agreementAccepted && unread.length > 0) {
            setShowAllAnnouncements(false);
            setShowAnnouncements(true);
          }
        }
      } catch (error) {
        if (signal.aborted) return;
        console.error('加载内容失败:', error);
      }
    };

    // 登录后立即加载内容，无需等待协议判定
    loadContent();

    return () => controller.abort();
  }, [isAuthenticated, agreementAccepted]);

  // 加载新曲速递数据（独立于公告，避免因协议判定变化触发重复请求）
  useEffect(() => {
    if (!isAuthenticated) return;

    const controller = new AbortController();
    loadSongUpdates(controller.signal);

    return () => controller.abort();
  }, [isAuthenticated, loadSongUpdates]);

  // 说明：未登录时软跳转 /login，避免硬刷新带来的体验割裂。
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <h1 className="sr-only">正在加载个人成绩仪表盘 - Phigros Query</h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <RotatingTips />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950 flex items-center justify-center">
        <div className="text-sm text-gray-600 dark:text-gray-400">正在跳转到登录页…</div>
      </div>
    );
  }

  const renderContent = () => (
    <DashboardTabContent
      activeTab={activeTab}
      debugExport={debugExport}
      songUpdates={songUpdates}
      songUpdatesStatus={songUpdatesStatus}
      songUpdatesError={songUpdatesError}
      onRetrySongUpdates={() => void loadSongUpdates()}
    />
  );

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

      <div
        className="flex h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950"
        style={{ height: '100dvh' }}
      >
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
          onOpenAnnouncements={() => { setShowAllAnnouncements(true); setShowAnnouncements(true); }}
        />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* First-time Menu Guide - Only show when announcements are not visible */}
        {!showAnnouncements && showMenuGuide && <MenuGuide onDismiss={() => setShowMenuGuide(false)} />}

        {/* Header with integrated menu button */}
        <DashboardHeader
          onOpenAnnouncements={() => { setShowAllAnnouncements(true); setShowAnnouncements(true); }}
          onOpenMenu={() => setIsMobileMenuOpen(true)}
        />

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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-6xl mx-auto">
            {renderContent()}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm flex items-center justify-center px-3 text-center py-3">
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
