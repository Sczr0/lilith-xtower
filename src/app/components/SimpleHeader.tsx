'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../contexts/AuthContext';

interface SimpleHeaderProps {
  showLogin?: boolean;
}

const navLinks = [
  { href: '/about', label: '关于' },
  { href: '/sponsors', label: '赞助者' },
  { href: '/qa', label: '常见问题' },
  { href: '/unified-api', label: '联合API接入' },
  { href: '/contribute', label: '投稿' },
  { href: '/dashboard', label: '仪表盘' },
];

/**
 * 通用 Header：桌面端导航 + 移动端汉堡菜单
 * 复用主页交互，避免各页面在小屏溢出
 */
export function SimpleHeader({ showLogin = true }: SimpleHeaderProps) {
  const { isAuthenticated } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleToggle = () => setIsMobileMenuOpen((prev) => !prev);
  const handleClose = () => setIsMobileMenuOpen(false);

  return (
    <>
      <header className="sticky top-0 z-40 h-14 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 lg:px-6 flex items-center">
        <Link href="/" className="text-base font-semibold text-gray-900 dark:text-gray-50 whitespace-nowrap">
          Phigros 查询
        </Link>

        {/* 桌面端导航 */}
        <nav className="ml-auto hidden md:flex items-center gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          {showLogin && !isAuthenticated && (
            <Link
              href="/login"
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              登录
            </Link>
          )}
          <ThemeToggle />
        </nav>

        {/* 移动端：主题切换 + 汉堡菜单按钮 */}
        <div className="ml-auto flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={handleToggle}
            className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label={isMobileMenuOpen ? '关闭菜单' : '打开菜单'}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* 移动端下拉菜单 */}
      {isMobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-30 md:hidden"
            onClick={handleClose}
            aria-hidden="true"
          />
          <nav className="fixed top-14 left-0 right-0 z-40 bg-white dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-800 shadow-lg md:hidden">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={handleClose}
                  className="block px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              {showLogin && !isAuthenticated && (
                <Link
                  href="/login"
                  onClick={handleClose}
                  className="block px-3 py-2.5 rounded-lg text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20 transition-colors"
                >
                  登录
                </Link>
              )}
            </div>
          </nav>
        </>
      )}
    </>
  );
}
