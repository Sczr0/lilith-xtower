'use client';

import type { AuthCredentialSummary } from '../lib/auth/credentialSummary';

interface AuthStatusBannerProps {
  credential: AuthCredentialSummary;
  onShowDetails: () => void;
  onLogout: () => void;
}

export function AuthStatusBanner({ credential, onShowDetails, onLogout }: AuthStatusBannerProps) {
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCredentialTypeText = () => {
    switch (credential.type) {
      case 'session':
        return 'SessionToken';
      case 'api':
        return '联合查分 API';
      case 'platform':
        return '联合查分平台';
      default:
        return '未知类型';
    }
  };

  const getCredentialIcon = () => {
    switch (credential.type) {
      case 'session':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        );
      case 'api':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        );
      case 'platform':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
    }
  };

  return (
    <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
      {/* 在小屏改为上下布局，避免图标与文本/按钮拥挤错位 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-start justify-start sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 bg-green-100 dark:bg-green-800/30 rounded-lg text-green-600 dark:text-green-400">
            {getCredentialIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-green-900 dark:text-green-100">
                当前已登录
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800/50 dark:text-green-200">
                {getCredentialTypeText()}
              </span>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300">
              登录时间: {formatTimestamp(credential.timestamp)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 sm:justify-end sm:self-start">
          <button
            onClick={onShowDetails}
            className="px-3 py-1.5 text-sm font-medium text-green-700 hover:text-green-900 dark:text-green-300 dark:hover:text-green-100 hover:bg-green-100 dark:hover:bg-green-800/50 rounded-lg transition-colors"
          >
            查看详情
          </button>
          <button
            onClick={onLogout}
            className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
}
