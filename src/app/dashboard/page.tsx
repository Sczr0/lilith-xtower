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

const parseDebugExport = (value: string | null): boolean => value === '1' || value === 'true';

export default function Dashboard() {
  const { isAuthenticated, isLoading, error } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // 说明：tab 与 debug 以 URL 查询参数为单一来源，避免组件内再做“硬刷新”同步。
  const tabParam = searchParams.get('tab');
  const activeTab: TabId = tabParam && isDashboardTabId(tabParam) ? tabParam : 'best-n';
  const debugExport = parseDebugExport(searchParams.get('debug'));
  const [menuGuideDismissed, setMenuGuideDismissed] = useState(false);
  const agreementAccepted = useClientValue(() => localStorage.getItem(AGREEMENT_ACCEPTED_KEY) === 'true', false);
  const showMenuGuide = agreementAccepted && !menuGuideDismissed;

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

  const handleTabChange = useCallback((tabId: TabId) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', tabId);
    router.replace(`/dashboard?${next.toString()}`, { scroll: false });
  }, [router, searchParams]);

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
        <div className="flex flex-col items-center" role="status" aria-live="polite">
          <span className="sr-only">正在加载个人成绩仪表盘 - Phigros Query</span>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" aria-hidden="true"></div>
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
    <>
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
    </>
  );
}
