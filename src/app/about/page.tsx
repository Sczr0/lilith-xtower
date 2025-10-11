'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '../components/ThemeToggle';
import { ServiceStats } from '../components/ServiceStats';
import MarkdownBlock from '../components/MarkdownBlock';
import SponsorsList from '../components/SponsorsList';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';

export default function AboutPage() {
  const { isAuthenticated } = useAuth();
  // 头像图片放置于 public/about/avatar.png；裁剪通过 objectPosition 或 Tailwind 的 object-[x_y] 调整
  const AVATAR_SRC = '/about/avatar.png';

  // 检测部署平台（只在客户端判断，避免 hydration mismatch）
  const [isVercel, setIsVercel] = useState(false);
  const [isNetlify, setIsNetlify] = useState(false);

  useEffect(() => {
    setIsVercel(
      window.location.hostname.includes('vercel.app') || 
      window.location.hostname === 'lilith.xtower.site' // 如果是你的主域名且部署在Vercel
    );
    setIsNetlify(window.location.hostname.includes('netlify.app'));
  }, []);

  const serviceProviders = [
    {
      name: 'Cloudflare',
      url: 'https://www.cloudflare.com',
      logo: (
        <Image
          src="/Cloudflare.png"
          alt="Cloudflare"
          width={120}
          height={32}
          className="h-8 w-auto"
        />
      ),
      description: 'CDN，DNS与安全服务',
      show: true
    },
    {
      name: 'Vercel',
      url: 'https://vercel.com',
      logo: (
        <svg height="32" viewBox="0 0 283 64" fill="none" className="text-black dark:text-white">
          <path fill="currentColor" d="M141.68 16.25c-11.04 0-19 7.2-19 18s8.96 18 20 18c6.67 0 12.55-2.64 16.19-7.09l-7.65-4.42c-2.02 2.21-5.09 3.5-8.54 3.5-4.79 0-8.86-2.5-10.37-6.5h28.02c.22-1.12.35-2.28.35-3.5 0-10.79-7.96-17.99-19-17.99zm-9.46 14.5c1.25-3.99 4.67-6.5 9.45-6.5 4.79 0 8.21 2.51 9.45 6.5h-18.9zM248.72 16c-11.04 0-19 7.2-19 18s8.96 18 20 18c6.67 0 12.55-2.64 16.19-7.09l-7.65-4.42c-2.02 2.21-5.09 3.5-8.54 3.5-4.79 0-8.86-2.5-10.37-6.5h28.02c.22-1.12.35-2.28.35-3.5 0-10.79-7.96-17.99-19-17.99zm-9.45 14.5c1.25-3.99 4.67-6.5 9.45-6.5 4.79 0 8.21 2.51 9.45 6.5h-18.9zM200.24 34c0 6 3.92 10 10 10 4.12 0 7.21-1.87 8.8-4.92l7.68 4.43c-3.18 5.3-9.14 8.49-16.48 8.49-11.05 0-19-7.2-19-18s7.96-18 19-18c7.34 0 13.29 3.19 16.48 8.49l-7.68 4.43c-1.59-3.05-4.68-4.92-8.8-4.92-6.07 0-10 4-10 10zm82.48-29v46h-9V5h9zM36.95 0L73.9 64H0L36.95 0zm92.38 5l-27.71 48L73.91 5H84.3l17.32 30 17.32-30h10.39zm58.91 12v9.69c-1-.29-2.06-.49-3.2-.49-5.81 0-10 4-10 10V51h-9V17h9v9.2c0-5.08 5.91-9.2 13.2-9.2z"/>
        </svg>
      ),
      description: '部署与托管服务',
      show: isVercel
    },
    {
      name: 'Netlify',
      url: 'https://www.netlify.com',
      logo: (
        <img
          src="https://www.netlify.com/assets/badges/netlify-badge-color-accent.svg"
          alt="Deploys by Netlify"
          className="h-8 w-auto"
        />
      ),
      description: '部署与托管服务',
      show: isNetlify
    }
  ].filter(provider => provider.show);

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
          <Link href="/sponsors" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">赞助者</Link>
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

          {/* 感谢服务提供商 */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">感谢</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">感谢以下服务提供商为本站提供的优质服务</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {serviceProviders.map((provider, index) => (
                <a
                  key={index}
                  href={provider.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-gray-200 dark:border-neutral-800 rounded-xl p-5 hover:border-gray-300 dark:hover:border-neutral-700 transition-colors flex flex-col items-center justify-center gap-3 group"
                >
                  <div className="flex items-center justify-center">
                    {provider.logo}
                  </div>
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400">{provider.description}</p>
                </a>
              ))}
            </div>
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

          {/* 简短页脚 */}
          <footer className="pt-4 border-t border-gray-200 dark:border-neutral-800 text-sm text-gray-500 dark:text-gray-400">
            © 2025 Phigros Query · <Link href="/agreement" className="hover:text-blue-600 dark:hover:text-blue-400">用户协议</Link>
          </footer>
        </div>
      </main>
    </div>
  );
}
