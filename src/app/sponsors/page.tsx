import Link from "next/link";
import { SimpleHeader } from "../components/SimpleHeader";
import SponsorsList from "../components/SponsorsList";

// ISR: 每 10 分钟重新验证一次（赞助者数据更新不频繁）
export const revalidate = 600;

/**
 * 赞助者页面 - SSR + ISR
 * 静态内容在服务端渲染，赞助者列表由客户端组件处理分页
 */
export default function SponsorsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-50">
      {/* Header */}
      <SimpleHeader />

      {/* Main */}
      <main className="px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-4xl space-y-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">赞助者</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            感谢所有赞助本项目的朋友们。<br />
            注：本页面仅展示爱发电的赞助者，其他赞助方式的赞助者在此不展示，但一并在此感谢。
          </p>

          {/* 赞助者列表：客户端组件处理分页交互 */}
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
            {' · '}
            <Link
              href="/privacy"
              className="hover:text-blue-600 dark:hover:text-blue-400"
            >
              隐私协议
            </Link>
          </footer>
        </div>
      </main>
    </div>
  );
}