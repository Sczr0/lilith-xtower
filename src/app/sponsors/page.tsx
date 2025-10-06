"use client";

import Link from "next/link";
import { ThemeToggle } from "../components/ThemeToggle";
import SponsorsList from "../components/SponsorsList";
import { useAuth } from "../contexts/AuthContext";

// 独立赞助者页面：沿用关于页的头部与排版风格，复用 SponsorsList 组件
export default function SponsorsPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 h-14 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 lg:px-6 flex items-center">
        <Link href="/" className="text-base font-semibold">
          Phigros 查询
        </Link>
        <nav className="ml-auto flex items-center gap-4">
          <Link
            href="/about"
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            关于
          </Link>
          <Link
            href="/qa"
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            常见问题
          </Link>
          {!isAuthenticated && (
            <Link
              href="/login"
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              登录
            </Link>
          )}
          <Link
            href="/dashboard"
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            控制台
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      {/* Main */}
      <main className="px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-4xl space-y-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">赞助者</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            感谢所有赞助本项目的朋友们。<br />
            注：本页面仅展示爱发电的赞助者，其他赞助方式的赞助者在此不展示，但一并在此感谢。
          </p>

          {/* 赞助者列表：复用内部 API /internal/sponsors */}
          <SponsorsList initialPerPage={24} />

          {/* 简短页脚 */}
          <footer className="pt-4 border-t border-gray-200 dark:border-neutral-800 text-sm text-gray-500 dark:text-gray-400">
            © 2025 Phigros Query ·
            <Link
              href="/agreement"
              className="hover:text-blue-600 dark:hover:text-blue-400 ml-1"
            >
              用户协议
            </Link>
          </footer>
        </div>
      </main>
    </div>
  );
}
