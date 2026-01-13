import Link from "next/link";
import { SiteHeader } from "../components/SiteHeader";
import SponsorsList from "../components/SponsorsList";
import { fetchAfdianSponsorsCached } from "../lib/sponsors/afdian";
import type { SponsorItem } from "../lib/types/sponsors";

// ISR: 每 10 分钟重新验证一次（赞助者数据更新不频繁）
export const revalidate = 600;

/**
 * 赞助者页面 - SSR + ISR
 * 静态内容在服务端渲染，赞助者列表由客户端组件处理分页
 */
export default async function SponsorsPage() {
  const initialPerPage = 24;
  let initialData: { items: SponsorItem[]; page: number; totalPage: number } | null = null;

  try {
    const result = await fetchAfdianSponsorsCached(1, initialPerPage);
    if (result.ok && result.payload.ec === 200 && result.payload.data?.list?.length) {
      initialData = {
        items: result.payload.data.list,
        page: 1,
        totalPage: result.payload.data.total_page || 1,
      };
    }
  } catch {
    // 说明：SSR 首屏列表为“尽力而为”，失败时由客户端继续拉取（或展示错误提示）。
    initialData = null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-50">
      {/* Header */}
      <SiteHeader />

      {/* Main */}
      <main className="px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-4xl space-y-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">赞助者名单</h1>
          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-400">
            <p>
              Phigros Query 的持续运行与维护离不开广大玩家的支持。在这里，我们要向所有通过各种方式支持本项目的赞助者表示最诚挚的感谢。
            </p>
            <p className="text-xs italic">
              注：本页面目前主要展示通过爱发电平台支持的赞助者名单。如果您通过其他方式提供了帮助，虽然可能未在此列表中实时显示，但您的贡献同样被我们铭记在心。
            </p>
          </div>

          {/* 赞助者列表：客户端组件处理分页交互 */}
          <SponsorsList initialPerPage={initialPerPage} initialData={initialData} />

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
