'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { type TabId, isDashboardTabId } from './components/Sidebar';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnnouncementModal } from '../components/AnnouncementModal';
import { MenuGuide } from './components/MenuGuide';
import { RotatingTips } from '../components/RotatingTips';
import { DashboardTabContent } from './components/DashboardTabContent';
import { useDashboardPrefetch } from './hooks/useDashboardPrefetch';
import { useDashboardContent } from './hooks/useDashboardContent';
import { useClientValue } from '../hooks/useClientValue';
import { AGREEMENT_ACCEPTED_KEY } from '../lib/constants/storageKeys';
import { DashboardShell } from './components/DashboardShell';
import { PageShell } from '../components/PageShell';

const parseDebugExport = (value: string | null): boolean => value === '1' || value === 'true';

export default function Dashboard() {
  const { isAuthenticated, isLoading, error } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab 状态：以 React state 为主，URL 仅做初始读取与同步，避免 Next Router 导航触发服务端请求。
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const tabParam = searchParams.get('tab');
    return tabParam && isDashboardTabId(tabParam) ? tabParam : 'best-n';
  });

  const debugExport = parseDebugExport(searchParams.get('debug'));
  const [menuGuideDismissed, setMenuGuideDismissed] = useState(false);
  const agreementAccepted = useClientValue(() => localStorage.getItem(AGREEMENT_ACCEPTED_KEY) === 'true', false);
  const showMenuGuide = agreementAccepted && !menuGuideDismissed;

  // 浏览器前进/后退时同步 tab 状态
  useEffect(() => {
    const syncTabFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && isDashboardTabId(tabParam)) {
        setActiveTab(tabParam);
      }
    };
    window.addEventListener('popstate', syncTabFromUrl);
    return () => window.removeEventListener('popstate', syncTabFromUrl);
  }, []);

  useDashboardPrefetch({ isAuthenticated, activeTab });
  const {
    announcements,
    showAnnouncements,
    showAllAnnouncements,
    openAnnouncements,
    closeAnnouncements,
    songUpdates,
    songUpdatesStatus,
    songUpdatesError,
    reloadSongUpdates,
  } = useDashboardContent({ isAuthenticated, agreementAccepted });

  // 说明：用 window.history.replaceState 同步 URL，绕过 Next Router 的 segment cache，
  // 避免动态渲染页面上每次 navigation 触发服务端 RSC 请求导致页面刷新。
  const handleTabChange = useCallback((tabId: TabId) => {
    if (tabId === activeTab) return;
    setActiveTab(tabId);
    const next = new URLSearchParams(window.location.search);
    next.set('tab', tabId);
    window.history.replaceState(null, '', `?${next.toString()}`);
  }, [activeTab]);

  // 说明：未登录时软跳转 /login，避免硬刷新带来的体验割裂。
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <PageShell
        variant="gradient"
        footerVariant="none"
        mainClassName="flex min-h-screen items-center justify-center px-4 py-10"
        containerClassName="mx-auto max-w-4xl"
      >
        <div className="flex flex-col items-center" role="status" aria-live="polite">
          <span className="sr-only">正在加载个人成绩仪表盘 - Phigros Query</span>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" aria-hidden="true"></div>
          <RotatingTips />
        </div>
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageShell
        variant="gradient"
        footerVariant="none"
        mainClassName="flex min-h-screen items-center justify-center px-4 py-10"
        containerClassName="mx-auto max-w-4xl"
      >
        <div className="text-sm text-gray-600 dark:text-gray-400">正在跳转到登录页…</div>
      </PageShell>
    );
  }

  const renderContent = () => (
    <DashboardTabContent
      activeTab={activeTab}
      debugExport={debugExport}
      songUpdates={songUpdates}
      songUpdatesStatus={songUpdatesStatus}
      songUpdatesError={songUpdatesError}
      onRetrySongUpdates={() => void reloadSongUpdates()}
    />
  );

  const footer =
    activeTab === 'best-n' || activeTab === 'single-query' ? (
      <p className="text-[13px] text-gray-500 dark:text-gray-400">
        页面与生成代码 © 2025-2026 Phigros Query；第三方素材（如封面/标识）版权归各自权利人所有，未经许可不得用于商业用途。
      </p>
    ) : undefined;

  return (
    <PageShell variant="gradient" main={false} footerVariant="none">
      {/* 公告弹窗 */}
      {showAnnouncements && announcements.length > 0 && (
        <AnnouncementModal
          announcements={announcements}
          showAll={showAllAnnouncements}
          onClose={closeAnnouncements}
        />
      )}

      <DashboardShell
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenAnnouncements={() => openAnnouncements({ showAll: true })}
        beforeMain={
          <>
            {!showAnnouncements && showMenuGuide && <MenuGuide onDismiss={() => setMenuGuideDismissed(true)} />}
            {error && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-6 py-3">
                <div className="max-w-6xl mx-auto flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">{error}</p>
                </div>
              </div>
            )}
          </>
        }
        footer={footer}
      >
        {renderContent()}
      </DashboardShell>
    </PageShell>
  );
}
