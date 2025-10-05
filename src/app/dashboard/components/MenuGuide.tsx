'use client';

import { useState, useEffect } from 'react';

interface MenuGuideProps {
  onDismiss: () => void;
}

export function MenuGuide({ onDismiss }: MenuGuideProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hasSeenGuide = localStorage.getItem('dashboard_menu_guide_seen');
    if (!hasSeenGuide) {
      setTimeout(() => setShow(true), 500);
    }
  }, []);

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('dashboard_menu_guide_seen', 'true');
    setTimeout(() => onDismiss(), 300);
  };

  if (!show) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/50 z-[60] lg:hidden animate-fade-in"
        onClick={handleDismiss}
      />
      
      {/* 引导提示 */}
      <div className="fixed top-20 left-2 z-[70] lg:hidden animate-slide-in-left">
        {/* 箭头指向菜单按钮 */}
        <div className="absolute -top-8 left-4 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[16px] border-b-blue-600 animate-bounce-slow" />
        
        {/* 提示卡片 */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-5 py-4 rounded-xl shadow-2xl max-w-[280px]">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">首次使用提示</h3>
              <p className="text-sm text-blue-50 leading-relaxed">
                点击左上角的「菜单」按钮可以切换不同功能，包括单曲查询、RKS 列表等更多工具！
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="mt-4 w-full bg-white/20 hover:bg-white/30 text-white font-medium py-2 px-4 rounded-lg transition-colors backdrop-blur-sm"
          >
            我知道了
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-in-left {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.4s ease-out;
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
