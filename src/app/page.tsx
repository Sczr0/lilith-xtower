'use client';

import Link from 'next/link';
import Script from 'next/script';
import { ThemeToggle } from './components/ThemeToggle';
import { useAuth } from './contexts/AuthContext';
import { useEffect } from 'react';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();

  // 已登录则跳转到控制台，保持原有行为
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      window.location.href = '/dashboard';
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-50">
      <Script
        id="ld-json-home"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Phigros Query',
            url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lilith.xtower.site',
            potentialAction: {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lilith.xtower.site') + '/qa?q={search_term_string}',
              },
              'query-input': 'required name=search_term_string',
            },
          }),
        }}
      />
      {/* 头部：对齐 About 页的极简导航 */}
      <header className="sticky top-0 z-40 h-14 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 lg:px-6 flex items-center">
        <Link href="/" className="text-base font-semibold">Phigros 查询</Link>
        <nav className="ml-auto flex items-center gap-4">
          <Link href="/sponsors" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">赞助者</Link>
          <Link href="/qa" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">常见问题</Link>
          {!isAuthenticated && (
            <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">登录</Link>
          )}
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">控制台</Link>
          <ThemeToggle />
        </nav>
      </header>

      {/* 主体：收敛为简洁排版与黑白灰蓝配色 */}
      <main className="px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-4xl space-y-10">
          {/* 简洁 Hero */}
          <section className="text-center space-y-4">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Phigros 查询工具</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              查询成绩、生成图片、分析数据，欢迎来到空间站「塔弦」下属的 Phigros 查询工具 ~ 
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Link href="/login" className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
                立即开始
              </Link>
              <a href="#features" className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-blue-600 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-950/30">
                了解更多
              </a>
            </div>
          </section>

          {/* 功能概览（边框卡片，去除炫彩与阴影） */}
          <section id="features" className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
              <div className="mb-3 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-1">Best N 成绩图片</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">生成最佳 N 首歌曲成绩汇总图片，支持深浅色主题。</p>
            </div>
            <div className="border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
              <div className="mb-3 flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-1">单曲成绩查询</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">查询歌曲成绩详情：准确率、连击数、评级等。</p>
            </div>
            <div className="border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
              <div className="mb-3 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-1">RKS 成绩列表</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">查看 RKS 计算详情，了解水平与提升空间。</p>
            </div>
          </section>

          {/* 使用指引（简化版） */}
          <section className="border border-gray-200 dark:border-neutral-800 rounded-xl p-4 sm:p-5">
            <h2 className="text-lg font-semibold mb-4">如何使用</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-500 dark:text-gray-400 mb-1">1</div>
                <p className="text-gray-700 dark:text-gray-300">选择登录方式（扫码/SessionToken/API）。</p>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400 mb-1">2</div>
                <p className="text-gray-700 dark:text-gray-300">验证凭证，系统自动拉取数据。</p>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400 mb-1">3</div>
                <p className="text-gray-700 dark:text-gray-300">在控制台选择功能开始查询。</p>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400 mb-1">4</div>
                <p className="text-gray-700 dark:text-gray-300">导出图片/数据，便捷分享。</p>
              </div>
            </div>
          </section>

          {/* 页脚（与 About 一致的极简风格） */}
          <footer className="pt-4 border-t border-gray-200 dark:border-neutral-800 text-sm text-gray-500 dark:text-gray-400">
            © 2025 Phigros Query · <Link href="/agreement" className="hover:text-blue-600 dark:hover:text-blue-400">用户协议</Link>
          </footer>
        </div>
      </main>
    </div>
  );
}
