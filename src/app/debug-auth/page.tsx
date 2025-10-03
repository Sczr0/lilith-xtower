'use client';

import { useAuth } from '../contexts/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';

export default function DebugAuthPage() {
  const { isAuthenticated, credential, isLoading, logout } = useAuth();

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
      <header className="px-4 lg:px-6 h-14 flex items-center justify-between backdrop-blur-sm bg-white/30 dark:bg-gray-900/30">
        <div className="flex items-center space-x-4">
          <a className="flex items-center justify-center" href="/">
            <span className="text-lg font-semibold">Phigros 查询</span>
          </a>
          <a 
            href="/login" 
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            登录页面
          </a>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-4">
              认证调试页面
            </h1>
            <p className="text-gray-500 md:text-xl dark:text-gray-400">
              查看当前登录状态和凭证信息
            </p>
          </div>

          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50 dark:border-gray-700/50">
            {/* 认证状态 */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">认证状态</h2>
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                isAuthenticated 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  isAuthenticated ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                {isAuthenticated ? '已登录' : '未登录'}
              </div>
            </div>

            {/* 凭证信息 */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">凭证信息</h2>
              {renderCredentialInfo()}
            </div>

            {/* 操作按钮 */}
            <div className="flex space-x-4">
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
              >
                返回主页
              </button>
              {isAuthenticated && (
                <button
                  onClick={logout}
                  className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                >
                  退出登录
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center h-16 backdrop-blur-sm bg-white/30 dark:bg-gray-900/30">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          © 2024 Phigros Query. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}