'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '../components/ThemeToggle';
import { ServiceStats } from '../components/ServiceStats';
import MarkdownBlock from '../components/MarkdownBlock';
import SponsorsList from '../components/SponsorsList';
import { useAuth } from '../contexts/AuthContext';

export default function AboutPage() {
  const { isAuthenticated } = useAuth();
  // 头像图片放置于 public/about/avatar.png；裁剪通过 objectPosition 或 Tailwind 的 object-[x_y] 调整
  const AVATAR_SRC = '/about/avatar.png';

  const supportLinks = [
    {
      title: '技术支持',
      links: [
        { name: '技术支持方', url: 'https://github.com/Sczr0', external: true },
        { name: '官方群聊', url: 'https://qm.qq.com/q/YQMW1eiz8m', external: true },
        { name: '反馈问题与建议', url: 'https://www.wjx.cn/vm/rDY4LVs.aspx#', external: true }
      ],
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    },
    {
      title: '服务监控',
      links: [
        { name: '数据访问统计', url: 'https://eu.umami.is/share/mRTglbfLNoT7Vofa/aw0000.xtower.site', external: true },
        { name: '服务可用性监控', url: 'https://stats.uptimerobot.com/cTTBFmsBaZ', external: true }
      ],
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      title: '社区资源',
      links: [
        { name: 'Phi-plugin 使用指引', url: 'https://www.kdocs.cn/l/catqcMM9UR5Y', external: true },
        { name: '爱发电', url: 'https://afdian.com/a/xtower', external: true }
      ],
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-50">
      {/* Header（保持极简） */}
      <header className="sticky top-0 z-40 h-14 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 lg:px-6 flex items-center">
        <Link href="/" className="text-base font-semibold">Phigros 查询</Link>
        <nav className="ml-auto flex items-center gap-4">
          <Link href="/qa" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">常见问题</Link>
          {!isAuthenticated && (
            <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">登录</Link>
          )}
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">控制台</Link>
          <ThemeToggle />
        </nav>
      </header>

      {/* Main */}
      <main className="px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-4xl space-y-10">
          {/* 顶部：头像 + 昵称（聊天软件风格） */}
          <section className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full overflow-hidden bg-gray-100 dark:bg-neutral-800">
              <Image
                src={AVATAR_SRC}
                alt="头像"
                width={64}
                height={64}
                className="h-16 w-16 rounded-full object-cover object-center"
                priority
              />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">弦塔</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Phigros 查询 · 主要（现在是唯一）维护者</p>
            </div>
          </section>

          {/* 可自填区域：从 public/about/custom.md 读取并渲染 */}
          <section className="border border-gray-200 dark:border-neutral-800 rounded-xl p-4 sm:p-5">
            <MarkdownBlock src="/about/custom.md" />
          </section>

          {/* 服务统计（极简配色） */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">服务统计</h2>
            <ServiceStats variant="mono" />
          </section>

          {/* 服务支持（黑白灰蓝） */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">服务支持</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {supportLinks.map((section, index) => (
                <div key={index} className="border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400">{section.icon}</span>
                    <h3 className="text-base font-medium">{section.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {section.links.map((link, linkIndex) => (
                      <li key={linkIndex}>
                        <a
                          href={link.url}
                          target={link.external ? '_blank' : undefined}
                          rel={link.external ? 'noopener noreferrer' : undefined}
                          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {link.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* 赞助者模块 */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">赞助者</h2>
            <SponsorsList initialPerPage={12} />
          </section>

          {/* 简短页脚 */}
          <footer className="pt-4 border-t border-gray-200 dark:border-neutral-800 text-sm text-gray-500 dark:text-gray-400">
            © 2025 Phigros Query · <Link href="/agreement" className="hover:text-blue-600 dark:hover:text-blue-400">用户协议</Link>
          </footer>
        </div>
      </main>
    </div>
  );
}
