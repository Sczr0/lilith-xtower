'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface MaintenanceBannerProps {
  message: string;
}

/**
 * 维护预告横幅
 * 在维护开始前几天显示在页面顶部
 * 用户可以手动关闭，关闭状态保存在 localStorage
 */
export function MaintenanceBanner({ message }: MaintenanceBannerProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 检查用户是否已关闭过横幅
    const dismissed = localStorage.getItem('maintenance_banner_dismissed');
    if (!dismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('maintenance_banner_dismissed', 'true');
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <div
              className="text-sm font-medium"
              dangerouslySetInnerHTML={{ __html: message }}
            />
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
