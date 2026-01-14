'use client';

import { useCallback, useEffect, useState } from 'react';

import type { Announcement, SongUpdate } from '../../lib/types/content';

type SongUpdatesStatus = 'idle' | 'loading' | 'success' | 'error';

const DISMISSED_ANNOUNCEMENTS_KEY = 'dismissed_announcements';

function readDismissedAnnouncementIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_ANNOUNCEMENTS_KEY);
    return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function hasUnreadAnnouncements(announcements: Announcement[]): boolean {
  const dismissed = readDismissedAnnouncementIds();
  return announcements.some((a) => !dismissed.has(a.id));
}

export interface DashboardContentState {
  announcements: Announcement[];
  showAnnouncements: boolean;
  showAllAnnouncements: boolean;
  openAnnouncements: (opts?: { showAll?: boolean }) => void;
  closeAnnouncements: () => void;

  songUpdates: SongUpdate[];
  songUpdatesStatus: SongUpdatesStatus;
  songUpdatesError: string | null;
  reloadSongUpdates: () => Promise<void>;
}

/**
 * /dashboard 内容数据加载（公告 + 新曲速递）
 *
 * 说明：
 * - 公告：登录后加载；若已同意协议且存在未读公告，则自动弹出。
 * - 新曲速递：独立加载，避免因公告/协议状态变化触发重复请求。
 */
export function useDashboardContent({
  isAuthenticated,
  agreementAccepted,
}: {
  isAuthenticated: boolean;
  agreementAccepted: boolean;
}): DashboardContentState {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);

  const openAnnouncements = useCallback((opts?: { showAll?: boolean }) => {
    setShowAllAnnouncements(!!opts?.showAll);
    setShowAnnouncements(true);
  }, []);

  const closeAnnouncements = useCallback(() => setShowAnnouncements(false), []);

  // 加载公告数据
  useEffect(() => {
    if (!isAuthenticated) return;

    const controller = new AbortController();
    const { signal } = controller;

    const load = async () => {
      try {
        const res = await fetch('/api/content/announcements', { signal });
        if (!res.ok) return;
        const data = (await res.json()) as Announcement[];
        setAnnouncements(data);

        // 仅当已同意用户协议时才展示公告，避免与协议弹窗叠加
        if (agreementAccepted && data.length > 0 && hasUnreadAnnouncements(data)) {
          setShowAllAnnouncements(false);
          setShowAnnouncements(true);
        }
      } catch (error) {
        if (signal.aborted) return;
        console.error('加载公告失败:', error);
      }
    };

    void load();
    return () => controller.abort();
  }, [isAuthenticated, agreementAccepted]);

  // 加载新曲速递数据（独立于公告，避免因协议判定变化触发重复请求）
  const [songUpdates, setSongUpdates] = useState<SongUpdate[]>([]);
  const [songUpdatesStatus, setSongUpdatesStatus] = useState<SongUpdatesStatus>('idle');
  const [songUpdatesError, setSongUpdatesError] = useState<string | null>(null);

  const loadSongUpdates = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) return;

    setSongUpdatesStatus('loading');
    setSongUpdatesError(null);

    try {
      const updatesRes = await fetch('/api/content/song-updates', { signal, cache: 'no-store' });
      if (!updatesRes.ok) {
        setSongUpdatesStatus('error');
        setSongUpdatesError('新曲速递加载失败，请稍后重试。');
        return;
      }

      const data = (await updatesRes.json()) as SongUpdate[];
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

  useEffect(() => {
    if (!isAuthenticated) return;

    const controller = new AbortController();
    // 说明：异步调度，避免在 effect 同步阶段直接触发一串 setState（符合 React 19 hooks 规则）。
    const timer = window.setTimeout(() => {
      void loadSongUpdates(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isAuthenticated, loadSongUpdates]);

  const reloadSongUpdates = useCallback(async () => {
    const controller = new AbortController();
    await loadSongUpdates(controller.signal);
  }, [loadSongUpdates]);

  return {
    announcements,
    showAnnouncements,
    showAllAnnouncements,
    openAnnouncements,
    closeAnnouncements,
    songUpdates,
    songUpdatesStatus,
    songUpdatesError,
    reloadSongUpdates,
  };
}
