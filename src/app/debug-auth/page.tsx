'use client';

import { useAuth } from '../contexts/AuthContext';
import Link from 'next/link';
import { useState } from 'react';
import { SiteHeader } from '../components/SiteHeader';

export default function DebugAuthPage() {
  const { isAuthenticated, credential, isLoading, logout, validateCurrentCredential } = useAuth();
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<null | 'valid' | 'invalid'>(null);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const renderCredentialInfo = () => {
    if (!credential) {
      return (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-700 dark:text-yellow-400">
            当前未登录，没有可显示的凭证信息。
          </p>
        </div>
      );
    }

    switch (credential.type) {
      case 'session':
        return (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="font-medium text-green-800 dark:text-green-300 mb-2">
                SessionToken 凭证
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-700 dark:text-green-400">类型:</span>
                  <span className="text-green-900 dark:text-green-200">SessionToken</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-700 dark:text-green-400">登录时间:</span>
                  <span className="text-green-900 dark:text-green-200">{formatTimestamp(credential.timestamp)}</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">SessionToken</h4>
              <code className="block bg-gray-100 dark:bg-gray-900 p-3 rounded text-sm break-all">
                {credential.token}
              </code>
            </div>
          </div>
        );

      case 'api':
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
                联合查分 API 凭证
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-400">类型:</span>
                  <span className="text-blue-900 dark:text-blue-200">联合查分 API</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-400">登录时间:</span>
                  <span className="text-blue-900 dark:text-blue-200">{formatTimestamp(credential.timestamp)}</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">API 凭证信息</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">用户 ID:</span>
                  <code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                    {credential.api_user_id}
                  </code>
                </div>
                {credential.api_token && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">API Token:</span>
                    <code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                      {credential.api_token}
                    </code>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'platform':
        return (
          <div className="space-y-4">
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <h3 className="font-medium text-purple-800 dark:text-purple-300 mb-2">
                联合查分平台凭证
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-purple-700 dark:text-purple-400">类型:</span>
                  <span className="text-purple-900 dark:text-purple-200">平台登录</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-700 dark:text-purple-400">登录时间:</span>
                  <span className="text-purple-900 dark:text-purple-200">{formatTimestamp(credential.timestamp)}</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">平台凭证信息</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">平台:</span>
                  <code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                    {credential.platform}
                  </code>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">平台用户 ID:</span>
                  <code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                    {credential.platform_id}
                  </code>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-400">
              未知的凭证类型
            </p>
          </div>
        );
    }
  };

  // 触发重新验证当前凭证
  const handleRevalidate = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const ok = await validateCurrentCredential();
      setVerifyResult(ok ? 'valid' : 'invalid');
    } finally {
      setVerifying(false);
    }
  };

  // 屏蔽敏感字段后输出 JSON（仅用于“更多详情”折叠内容）
  const mask = (s: string) => {
    if (!s) return '';
    if (s.length <= 8) return '••••';
    return `${s.slice(0, 6)}…${s.slice(-4)}`;
  };
  const sanitizedCredential = credential
    ? (() => {
        const base: Record<string, unknown> = { ...(credential as unknown as Record<string, unknown>) };
        if (typeof base['token'] === 'string') base['token'] = mask(base['token'] as string);
        if (typeof base['api_token'] === 'string') base['api_token'] = mask(base['api_token'] as string);
        return base;
      })()
    : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950">
      {/* Header */}
      <SiteHeader />

      {/* Main Content */}
      <main className="flex-1 p-4">
        <div className="w-full max-w-5xl mx-auto space-y-6">
          {/* 极简页头：小号 overline + 简述 + 右侧操作 */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-widest text-gray-500 dark:text-gray-400">调试</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">认证状态与凭证</div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-lg border border-gray-200/60 bg-white/60 hover:bg-white/80 text-gray-700 shadow-sm transition dark:border-gray-700/60 dark:bg-gray-800/50 dark:text-gray-200"
              >
                返回
              </Link>
              {isAuthenticated && (
                <button
                  onClick={logout}
                  className="px-3 py-1.5 rounded-lg border border-red-200/60 text-red-700 bg-red-50/60 hover:bg-red-50/90 shadow-sm transition dark:border-red-800/60 dark:text-red-300 dark:bg-red-900/20"
                >
                  退出登录
                </button>
              )}
            </div>
          </div>

          {/* 网格布局：上方双卡片，下方信息区，缓解页面下部留白 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 认证状态卡片 */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50 dark:border-gray-700/50">
              <div className="text-xs font-medium tracking-wider uppercase text-gray-500 dark:text-gray-400 mb-3">认证状态</div>
              <div
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                  isAuthenticated
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                }`}
              >
                <span
                  className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                    isAuthenticated ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                {isAuthenticated ? '已登录' : '未登录'}
              </div>
              {credential && (
                <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                  最近登录：{formatTimestamp(credential.timestamp)}
                </div>
              )}
            </div>

            {/* 快速操作卡片 */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50 dark:border-gray-700/50">
              <div className="text-xs font-medium tracking-wider uppercase text-gray-500 dark:text-gray-400 mb-3">快速操作</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleRevalidate}
                  disabled={verifying}
                  className="px-3 py-1.5 rounded-lg border border-blue-200/60 bg-blue-50/60 hover:bg-blue-50/90 text-blue-700 shadow-sm transition disabled:opacity-60 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-300"
                >
                  {verifying ? '验证中…' : '重新验证凭证'}
                </button>
                {isAuthenticated ? (
                  <Link
                    href="/dashboard"
                    className="px-3 py-1.5 rounded-lg border border-gray-200/60 bg-white/60 hover:bg-white/80 text-gray-700 shadow-sm transition dark:border-gray-700/60 dark:bg-gray-800/50 dark:text-gray-200"
                  >
                    前往仪表板
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="px-3 py-1.5 rounded-lg border border-gray-200/60 bg-white/60 hover:bg-white/80 text-gray-700 shadow-sm transition dark:border-gray-700/60 dark:bg-gray-800/50 dark:text-gray-200"
                  >
                    去登录
                  </Link>
                )}
                <Link
                  href="/qa"
                  className="px-3 py-1.5 rounded-lg border border-gray-200/60 bg-white/60 hover:bg-white/80 text-gray-700 shadow-sm transition dark:border-gray-700/60 dark:bg-gray-800/50 dark:text-gray-200"
                >
                  常见问题
                </Link>
              </div>
              {verifyResult && (
                <div className={`mt-3 text-xs ${verifyResult === 'valid' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {verifyResult === 'valid' ? '凭证有效' : '凭证无效或验证失败'}
                </div>
              )}
            </div>

            {/* 凭证信息区（占满两列） */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50 dark:border-gray-700/50 lg:col-span-2">
              <div className="text-xs font-medium tracking-wider uppercase text-gray-500 dark:text-gray-400 mb-3">凭证信息</div>
              {renderCredentialInfo()}

              {/* 更多详情（折叠） */}
              <details className="mt-6 group">
                <summary className="text-xs cursor-pointer select-none text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">更多详情（原始凭证 JSON，敏感字段已屏蔽）</summary>
                <pre className="mt-3 p-3 rounded bg-gray-100/70 dark:bg-gray-900/50 overflow-x-auto text-xs text-gray-700 dark:text-gray-300"><code>{JSON.stringify(sanitizedCredential, null, 2)}</code></pre>
              </details>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center h-16 backdrop-blur-sm bg-white/20 dark:bg-gray-900/20">
        <p className="text-sm text-gray-700/80 dark:text-gray-300/80">
          © 2025 Phigros Query. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
