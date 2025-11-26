'use client';

import Link from 'next/link';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../contexts/AuthContext';
import { useState, useTransition } from 'react';
import { submitTip } from './actions';

export default function ContributePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await submitTip(formData);
      setMessage({
        type: result.success ? 'success' : 'error',
        text: result.message,
      });
      if (result.success) {
        // 清空表单
        const form = document.getElementById('tip-form') as HTMLFormElement;
        form?.reset();
      }
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950">
      {/* Header */}
      <header className="relative z-10 px-4 lg:px-6 h-16 flex items-center justify-between backdrop-blur-sm bg-white/30 dark:bg-gray-900/30 border-b border-gray-200/50 dark:border-gray-700/50">
        <Link href="/" className="flex items-center justify-center">
          <span className="text-xl font-bold">Phigros 查询</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/qa"
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
          >
            常见问题
          </Link>
          <Link
            href="/about"
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
          >
            关于
          </Link>
          {!isLoading && (
            isAuthenticated ? (
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
              >
                仪表盘
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
              >
                登录
              </Link>
            )
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Title */}
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              投稿与反馈
            </h1>
            <p className="text-base text-gray-600 dark:text-gray-400">
              分享你的创意，或帮助我们改进
            </p>
          </div>

          {/* Tip Submission Card */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-6 sm:p-8 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Tips 投稿
              </h2>
            </div>

            <form id="tip-form" action={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="tip" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  你的 Tip 内容
                </label>
                <textarea
                  id="tip"
                  name="tip"
                  rows={4}
                  maxLength={100}
                  placeholder="输入你想分享的 Tip（限100字）..."
                  className="w-full px-4 py-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  required
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-right">
                  支持纯文本，请勿包含敏感信息
                </p>
              </div>

              {message && (
                <div className={`p-3 rounded-lg text-sm ${
                  message.type === 'success' 
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' 
                    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                }`}>
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    发送中...
                  </>
                ) : (
                  '提交投稿'
                )}
              </button>
            </form>
          </div>

          {/* Survey Placeholder Card */}
          <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-200/30 dark:border-gray-700/30 p-6 sm:p-8 border-dashed">
            <div className="flex items-center gap-3 mb-4 opacity-75">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                问卷调查
              </h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              暂时没有正在进行的问卷调查。如果有新的调研活动，我们会在这里发布链接。
            </p>
            <button disabled className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed">
              暂无活动
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex items-center justify-center h-16 backdrop-blur-sm bg-white/30 dark:bg-gray-900/30 border-t border-gray-200/50 dark:border-gray-700/50 mt-8">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          © 2025 Phigros Query. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}