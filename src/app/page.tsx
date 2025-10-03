'use client';

import { QueryInput } from "./components/QueryInput";
import { ThemeToggle } from "./components/ThemeToggle";
import { useAuth } from "./contexts/AuthContext";

export default function Home() {
  const { isAuthenticated, isLoading, logout, credential } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // 未登录时重定向到登录页面
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }

  const getWelcomeMessage = () => {
    if (!credential) return '欢迎回来！';

    switch (credential.type) {
      case 'session':
        return '欢迎使用 SessionToken 登录！';
      case 'api':
        return '欢迎使用联合查分 API 登录！';
      case 'platform':
        return `欢迎使用 ${credential.platform} 平台登录！`;
      default:
        return '欢迎回来！';
    }
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 text-gray-900 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950 dark:text-gray-50">
      {/* Header */}
      <header className="relative z-10 px-4 lg:px-6 h-14 flex items-center backdrop-blur-sm bg-white/30 dark:bg-gray-900/30">
        <a className="flex items-center justify-center" href="#">
          <span className="text-lg font-semibold">Phigros 查询</span>
        </a>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <a
            href="/debug-auth"
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            调试页面
          </a>
          <button
            onClick={logout}
            className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            退出登录
          </button>
          <ThemeToggle />
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Phigros 成绩查询与图片生成器
            </h1>
            <p className="text-green-600 md:text-xl dark:text-green-400 font-medium">
              {getWelcomeMessage()}
            </p>
            <p className="text-gray-500 md:text-xl dark:text-gray-400">
              您现在可以开始查询您的 Phigros 成绩了。
            </p>
          </div>
          <div className="flex justify-center">
            <QueryInput />
          </div>
          
          {/* 功能卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8 max-w-4xl mx-auto">
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-200/50 dark:border-gray-700/50">
              <h3 className="font-semibold text-lg mb-2">Best N 成绩图片</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                生成您的最佳 N 首歌曲成绩汇总图片
              </p>
            </div>
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-200/50 dark:border-gray-700/50">
              <h3 className="font-semibold text-lg mb-2">单曲成绩查询</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                查询特定歌曲的详细成绩信息
              </p>
            </div>
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-200/50 dark:border-gray-700/50">
              <h3 className="font-semibold text-lg mb-2">RKS 成绩列表</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                查看所有歌曲的 RKS 计算详情
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex items-center justify-center h-16 backdrop-blur-sm bg-white/30 dark:bg-gray-900/30">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          © 2024 Phigros Query. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
