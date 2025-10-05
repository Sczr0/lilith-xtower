'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { X } from 'lucide-react';
import { Announcement } from '../lib/types/content';

interface AnnouncementModalProps {
  announcements: Announcement[];
  onClose?: () => void;
  showAll?: boolean;
}

export function AnnouncementModal({ announcements, onClose, showAll = false }: AnnouncementModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const currentAnnouncement = announcements[currentIndex];

  useEffect(() => {
    if (showAll) return;
    const dismissed = localStorage.getItem('dismissed_announcements');
    if (dismissed) {
      try {
        setDismissedIds(new Set(JSON.parse(dismissed)));
      } catch (e) {
        console.error('解析已关闭公告列表失败:', e);
      }
    }
  }, [showAll]);

  const handleClose = (dontShowAgain: boolean) => {
    if (!showAll && dontShowAgain && currentAnnouncement.dismissible) {
      const newDismissed = new Set(dismissedIds);
      newDismissed.add(currentAnnouncement.id);
      setDismissedIds(newDismissed);
      localStorage.setItem('dismissed_announcements', JSON.stringify([...newDismissed]));
    }

    // 检查是否还有未读公告
    const nextIndex = currentIndex + 1;
    if (nextIndex < announcements.length) {
      setCurrentIndex(nextIndex);
    } else {
      onClose?.();
    }
  };

  // 过滤掉已关闭的公告
  const unreadAnnouncements = showAll ? announcements : announcements.filter(a => !dismissedIds.has(a.id));

  if (unreadAnnouncements.length === 0 || !currentAnnouncement) {
    return null;
  }

  const typeStyles = {
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-yellow-50 border-yellow-200',
    maintenance: 'bg-red-50 border-red-200'
  };

  const typeIcons = {
    info: '📘',
    warning: '⚠️',
    maintenance: '🔧'
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className={`px-6 py-4 border-b-2 ${typeStyles[currentAnnouncement.type]} dark:bg-gray-700 dark:border-gray-600 rounded-t-2xl flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{typeIcons[currentAnnouncement.type]}</span>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              {currentAnnouncement.title}
            </h2>
          </div>
          <button
            onClick={() => handleClose(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            aria-label="关闭"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{currentAnnouncement.content}</ReactMarkdown>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              {currentAnnouncement.dismissible && (
                <label className="flex items-center gap-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                  <input
                    type="checkbox"
                    id="dont-show-again"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>不再提示</span>
                </label>
              )}
              {announcements.length > 1 && (
                <span className="ml-auto">
                  {currentIndex + 1} / {announcements.length}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                const checkbox = document.getElementById('dont-show-again') as HTMLInputElement;
                handleClose(checkbox?.checked || false);
              }}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm hover:shadow-md"
            >
              {currentIndex + 1 < announcements.length ? '下一条' : '关闭'}
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            发布时间: {new Date(currentAnnouncement.publishDate).toLocaleString('zh-CN')}
          </div>
        </div>
      </div>
    </div>
  );
}
