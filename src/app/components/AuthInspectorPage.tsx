'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { SiteHeader } from './SiteHeader';

type AuthInspectorMode = 'safe' | 'debug';

interface AuthInspectorPageProps {
  mode: AuthInspectorMode;
}

export function AuthInspectorPage({ mode }: AuthInspectorPageProps) {
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

  // 说明：AuthContext 仅提供脱敏摘要；这里直接用于展示即可。
  const sanitizedCredential = credential ? { ...(credential as unknown as Record<string, unknown>) } : null;

  const renderCredentialInfo = () => {
    if (!credential) {
      return (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-700 dark:text-yellow-400">当前未登录，没有可显示的凭证信息。</p>
        </div>
      );
    }

    switch (credential.type) {
      case 'session':
        return (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="font-medium text-green-800 dark:text-green-300 mb-2">SessionToken 凭证</h3>
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
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-medium text-gray-700 dark:text-gray-300">SessionToken</h4>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">已遮罩</span>
              </div>
              <code className="mt-2 block bg-gray-100 dark:bg-gray-900 p-3 rounded text-sm break-all">
                {credential.tokenMasked}
              </code>
            </div>
          </div>
        );

      case 'api':
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">联合查分 API 凭证</h3>
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
                  <code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">{credential.api_user_id}</code>
                </div>
                {credential.api_token_masked && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">API Token:</span>
                    <code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                      {credential.api_token_masked}
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
              <h3 className="font-medium text-purple-800 dark:text-purple-300 mb-2">联合查分平台凭证</h3>
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
                  <code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">{credential.platform}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">平台用户 ID:</span>
                  <code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">{credential.platform_id}</code>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-400">未知的凭证类型</p>
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const overline = mode === 'debug' ? '调试' : '账户';
  const subtitle = mode === 'debug' ? '认证状态与基础信息（脱敏摘要，仅排障用）' : '认证状态与基础信息（敏感字段已遮罩）';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950">
      <SiteHeader />

      <main className="flex-1 p-4">
        <div className="w-full max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-widest text-gray-500 dark:text-gray-400">{overline}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{subtitle}</div>
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

          {mode === 'debug' && (
            <div className="rounded-xl border border-amber-200/70 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-900/10 p-4 text-sm text-amber-900 dark:text-amber-100">
              <div className="font-medium">调试模式提示</div>
              <p className="mt-1 text-amber-800/90 dark:text-amber-200/90">
                本页仅用于线上排障与技术支持。请勿截图/录屏分享；如需提供信息，请优先使用下方“更多详情”的遮罩 JSON。
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">最近登录：{formatTimestamp(credential.timestamp)}</div>
              )}
            </div>

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
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                提示：本页不会展示完整 token。如需技术支持，请提供下方“更多详情”中的遮罩信息。
              </div>
            </div>

            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50 dark:border-gray-700/50 lg:col-span-2">
              <div className="text-xs font-medium tracking-wider uppercase text-gray-500 dark:text-gray-400 mb-3">凭证信息</div>
              {renderCredentialInfo()}

              <details className="mt-6 group">
                <summary className="text-xs cursor-pointer select-none text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                  更多详情（原始凭证 JSON，敏感字段已屏蔽）
                </summary>
                <pre className="mt-3 p-3 rounded bg-gray-100/70 dark:bg-gray-900/50 overflow-x-auto text-xs text-gray-700 dark:text-gray-300">
                  <code>{JSON.stringify(sanitizedCredential, null, 2)}</code>
                </pre>
              </details>
            </div>
          </div>
        </div>
      </main>

      <footer className="flex items-center justify-center h-16 backdrop-blur-sm bg-white/20 dark:bg-gray-900/20">
        <p className="text-sm text-gray-700/80 dark:text-gray-300/80">© 2025 Phigros Query. All Rights Reserved.</p>
      </footer>
    </div>
  );
}
