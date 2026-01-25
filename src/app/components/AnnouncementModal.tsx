'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useMemo, useState } from 'react';
import { Markdown } from './Markdown';
import { X } from 'lucide-react';
import { Announcement } from '../lib/types/content';

interface AnnouncementModalProps {
  announcements: Announcement[];
  onClose?: () => void;
  showAll?: boolean; // 是否忽略“不再提示”过滤，展示全部公告
}

// 公告弹窗：支持“按条不再提示”、顺序浏览与进度指示
export type AnnouncementModalStep =
  | { kind: 'close' }
  | { kind: 'advance'; nextIndex: number };

export function computeNextAnnouncementModalStep(params: {
  visibleIndex: number;
  visibleCount: number;
  dismissCurrent: boolean;
}): AnnouncementModalStep {
  const { visibleIndex, visibleCount, dismissCurrent } = params;

  if (visibleCount <= 0) return { kind: 'close' };

  const safeIndex = Math.min(Math.max(visibleIndex, 0), visibleCount - 1);
  const isLastVisible = safeIndex + 1 >= visibleCount;
  if (isLastVisible) return { kind: 'close' };

  // 若当前条目会被过滤移除，则下一条会顶替当前位置，因此无需推进索引
  if (dismissCurrent) return { kind: 'advance', nextIndex: safeIndex };

  return { kind: 'advance', nextIndex: safeIndex + 1 };
}

function persistDismissedAnnouncements(ids: Set<string>) {
  try {
    localStorage.setItem('dismissed_announcements', JSON.stringify([...ids]));
  } catch {}
}

export function AnnouncementModal({ announcements, onClose, showAll = false }: AnnouncementModalProps) {
  const [open, setOpen] = useState(true);
  // 可见公告索引（基于过滤后列表）
  const [visibleIndex, setVisibleIndex] = useState(0);
  // 已关闭公告ID集合（本地持久化）
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // 仅在客户端加载已关闭状态，避免 hydration mismatch
  useEffect(() => {
    if (showAll) return;
    try {
      const raw = localStorage.getItem('dismissed_announcements');
      if (raw) {
        setDismissedIds(new Set(JSON.parse(raw)));
      }
    } catch (e) {
      console.error('解析已关闭公告列表失败', e);
    }
  }, [showAll]);
  // “不再提示”勾选状态（当前条目）
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (!open) onClose?.();
  }, [open, onClose]);

  // 过滤出应展示的公告列表
  const visibleAnnouncements = useMemo(() => {
    return showAll ? announcements : announcements.filter(a => !dismissedIds.has(a.id));
  }, [announcements, dismissedIds, showAll]);

  // 无可见公告则不渲染
  if (visibleAnnouncements.length === 0) {
    return null;
  }

  const safeIndex = Math.min(Math.max(visibleIndex, 0), visibleAnnouncements.length - 1);
  const current = visibleAnnouncements[safeIndex];

  const typeStyles = {
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-yellow-50 border-yellow-200',
    maintenance: 'bg-red-50 border-red-200'
  } as const;

  const typeIcons = {
    info: '📘',
    warning: '⚠️',
    maintenance: '🔧'
  } as const;

  // 关闭当前公告；若勾选"不再提示"且可关闭，则写入本地
  const handleClose = (applyDontShow: boolean) => {
    const dismissCurrent = !showAll && applyDontShow && current.dismissible;

    if (dismissCurrent) {
      const next = new Set(dismissedIds);
      next.add(current.id);
      setDismissedIds(next);
      persistDismissedAnnouncements(next);
    }

    setDontShowAgain(false);

    const step = computeNextAnnouncementModalStep({
      visibleIndex: safeIndex,
      visibleCount: visibleAnnouncements.length,
      dismissCurrent,
    });

    if (step.kind === 'close') {
      setOpen(false);
      return;
    }

    setVisibleIndex(step.nextIndex);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Overlay className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <Dialog.Content className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col focus:outline-none">
            {/* 头部 */}
            <div className={`px-6 py-4 border-b-2 ${typeStyles[current.type]} dark:bg-gray-700 dark:border-gray-600 rounded-t-2xl flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden>
                  {typeIcons[current.type]}
                </span>
                <Dialog.Title asChild>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                    {current.title}
                  </h2>
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  公告弹窗，{safeIndex + 1} / {visibleAnnouncements.length}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  aria-label="关闭公告弹窗"
                >
                  <X size={24} />
                </button>
              </Dialog.Close>
            </div>

            {/* 内容 */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <Markdown>{current.content}</Markdown>
              </div>
            </div>

            {/* 底部 */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  {current.dismissible && (
                    <label className="flex items-center gap-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={dontShowAgain}
                        onChange={(e) => setDontShowAgain(e.target.checked)}
                      />
                      <span>不再提示</span>
                    </label>
                  )}
                  {visibleAnnouncements.length > 1 && (
                    <span className="ml-auto">
                      {safeIndex + 1} / {visibleAnnouncements.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleClose(dontShowAgain)}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm hover:shadow-md"
                >
                  {safeIndex + 1 < visibleAnnouncements.length ? '下一条' : '关闭'}
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                发布时间: {new Date(current.publishDate).toLocaleString('zh-CN')}
              </div>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
