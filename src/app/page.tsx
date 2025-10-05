'use client';

import Link from 'next/link';
import { ThemeToggle } from "./components/ThemeToggle";
import { useAuth } from "./contexts/AuthContext";
import { useEffect } from 'react';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      window.location.href = '/dashboard';
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="relative flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 text-gray-900 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950 dark:text-gray-50">
      {/* Header */}
      <header className="relative z-10 px-4 lg:px-6 h-16 flex items-center backdrop-blur-sm bg-white/30 dark:bg-gray-900/30 border-b border-gray-200/50 dark:border-gray-700/50">
        <Link href="/" className="flex items-center justify-center">
          <span className="text-xl font-bold">Phigros 查询</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Link
            href="/qa"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
          >
            常见问题
          </Link>
          <Link
            href="/about"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
          >
            关于
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            登录
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12 lg:py-16">
        <div className="max-w-6xl mx-auto text-center space-y-8 sm:space-y-10 lg:space-y-12">
          <div className="space-y-4 sm:space-y-6">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl">
              <span className="block text-gray-900 dark:text-gray-100">
                Phigros 查询工具
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto px-2">
              查询成绩、生成图片、分析数据
              <br />
              您的 Phigros 游戏数据可视化平台
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mt-6 sm:mt-8">
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-base sm:text-lg transition-colors shadow-lg hover:shadow-xl"
              >
                立即开始
              </Link>
              <a
                href="#features"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg border-2 border-blue-600 text-blue-600 dark:text-blue-400 font-medium text-base sm:text-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              >
                了解更多
              </a>
            </div>
          </div>

          {/* Features Section */}
          <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mt-12 sm:mt-16 lg:mt-20">
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-gray-200/50 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-gray-900 dark:text-gray-100">Best N 成绩图片</h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                生成您的最佳 N 首歌曲成绩汇总图片，支持深色和白色主题，轻松分享您的游戏成就
              </p>
            </div>

            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-gray-200/50 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-purple-500/10 dark:bg-purple-500/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">单曲成绩查询</h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                查询特定歌曲的详细成绩信息，包括准确率、连击数、评级等完整数据
              </p>
            </div>

            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-gray-200/50 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-green-500/10 dark:bg-green-500/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">RKS 成绩列表</h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                查看所有歌曲的 RKS 计算详情，深入了解您的游戏水平和进步空间
              </p>
            </div>
          </div>

          {/* Tutorial Section */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl p-6 sm:p-8 lg:p-12 border border-gray-200/50 dark:border-gray-700/50 shadow-lg mt-12 sm:mt-16">
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
              如何使用
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 text-left">
              <div className="space-y-2 sm:space-y-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-base sm:text-lg">
                  1
                </div>
                <h3 className="font-semibold text-base sm:text-lg">选择登录方式</h3>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">
                  支持扫码登录、手动输入 SessionToken、API 凭证等多种方式
                </p>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-base sm:text-lg">
                  2
                </div>
                <h3 className="font-semibold text-base sm:text-lg">验证凭证</h3>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">
                  完成登录验证，系统会自动获取您的游戏数据
                </p>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-base sm:text-lg">
                  3
                </div>
                <h3 className="font-semibold text-base sm:text-lg">选择功能</h3>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">
                  在侧边栏中选择您需要的功能，开始查询和分析
                </p>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold text-base sm:text-lg">
                  4
                </div>
                <h3 className="font-semibold text-base sm:text-lg">导出分享</h3>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">
                  生成图片、导出数据，轻松分享您的游戏成绩
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex items-center justify-center h-16 backdrop-blur-sm bg-white/30 dark:bg-gray-900/30 border-t border-gray-200/50 dark:border-gray-700/50">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          © 2024 Phigros Query. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
