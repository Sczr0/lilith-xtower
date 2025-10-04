'use client';

import { useEffect } from 'react';
import { Wrench, Clock } from 'lucide-react';

interface MaintenanceOverlayProps {
  title: string;
  message: string;
  startTime: string;
  endTime: string;
}

/**
 * 维护全屏覆盖层
 * 在维护期间显示，阻止用户访问所有功能
 */
export function MaintenanceOverlay({
  title,
  message,
  startTime,
  endTime,
}: MaintenanceOverlayProps) {
  useEffect(() => {
    // 禁止页面滚动
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      {/* 背景动画效果 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* 主内容 */}
      <div className="relative max-w-2xl w-full bg-gray-800/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700 p-8 md:p-12">
        {/* 图标 */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-orange-500/30 rounded-full blur-xl animate-pulse" />
            <div className="relative bg-gradient-to-br from-orange-500 to-red-500 rounded-full p-6">
              <Wrench className="h-12 w-12 text-white animate-spin-slow" />
            </div>
          </div>
        </div>

        {/* 标题 */}
        <h1 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
          {title}
        </h1>

        {/* 消息内容 */}
        <div
          className="text-gray-300 text-center text-lg mb-8 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: message }}
        />

        {/* 时间信息 */}
        <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-700">
          <div className="flex items-start gap-3 mb-4">
            <Clock className="h-5 w-5 text-orange-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-gray-400 text-sm mb-1">维护时间段</div>
              <div className="text-white font-medium">
                {formatTime(startTime)}
                <span className="text-gray-500 mx-2">至</span>
                {formatTime(endTime)}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="h-5 w-5 flex items-center justify-center flex-shrink-0">
              <div className="h-2 w-2 bg-orange-400 rounded-full animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="text-gray-400 text-sm mb-1">当前状态</div>
              <div className="text-orange-400 font-medium">系统维护中</div>
            </div>
          </div>
        </div>

        {/* 提示信息 */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>维护期间所有功能暂时不可用</p>
          <p className="mt-2">页面将在维护结束后自动恢复，请稍后再试</p>
        </div>
      </div>
    </div>
  );
}
