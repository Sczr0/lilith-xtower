"use client";

import Link from 'next/link';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../contexts/AuthContext';

export function ClientHeader() {
  const { isAuthenticated } = useAuth();
  const linkHref = isAuthenticated ? '/dashboard' : '/login';
  const linkText = isAuthenticated ? '返回控制台' : '返回登录';

  return (
    <header className="sticky top-0 z-20 px-4 lg:px-6 h-16 flex items-center justify-between backdrop-blur-sm bg-white/30 dark:bg-gray-900/30 border-b border-gray-200/50 dark:border-gray-700/50">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <Link className="flex items-center justify-center" href="/">
            <span className="text-lg font-bold">用户协议</span>
          </Link>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Link
          href={linkHref}
          className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
        >
          {linkText}
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
