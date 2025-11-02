'use client';

import { useState, useRef, useEffect } from 'react';
import { Markdown } from './Markdown';

interface AgreementModalProps {
  html: string;
  onAgree: () => void;
  onClose: () => void;
}

export function AgreementModal({ html, onAgree, onClose }: AgreementModalProps) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const contentElement = contentRef.current;
    if (contentElement) {
      const { scrollTop, scrollHeight, clientHeight } = contentElement;
      const scrollPercentage = scrollTop / (scrollHeight - clientHeight);
      const bottomThreshold = 0.9; // 90% 位置视为底部

      setIsNearBottom(scrollPercentage >= bottomThreshold);

      if (scrollTop + clientHeight >= scrollHeight - 10) {
        setScrolledToBottom(true);
      }
    }
  };

  useEffect(() => {
    const contentElement = contentRef.current;
    if (contentElement) {
      if (contentElement.scrollHeight <= contentElement.clientHeight) {
        setScrolledToBottom(true);
        setIsNearBottom(true);
      }
    }
  }, [html]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[80vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">「塔弦」空间站 - Phigros 成绩查询与图片生成器 用户协议</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">请仔细阅读协议内容</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Content */}
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="flex-1 p-8 overflow-y-auto bg-white dark:bg-gray-800"
        >
          <article className="prose prose-lg dark:prose-invert max-w-none">
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </article>
        </div>

        {/* Footer */}
        <footer className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full transition-colors ${scrolledToBottom ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {scrolledToBottom ? '已阅读完毕' : '请滚动至底部阅读完整协议'}
                </span>
              </div>
              {isNearBottom && !scrolledToBottom && (
                <div className="text-xs text-amber-600 dark:text-amber-400 animate-pulse">
                  ↓ 继续向下滚动
                </div>
              )}
            </div>

            <div className="flex space-x-3 w-full sm:w-auto">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
              >
                暂不登录
              </button>
              <button
                onClick={onAgree}
                disabled={!scrolledToBottom}
                className={`flex-1 sm:flex-none px-8 py-3 font-semibold rounded-lg transition-all duration-300 ${
                  scrolledToBottom
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg transform hover:scale-105'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {scrolledToBottom ? '同意并继续登录' : '请先阅读完整协议'}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
