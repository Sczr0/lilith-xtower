'use client';

import Link from 'next/link';
import { ThemeToggle } from '../components/ThemeToggle';
import { ServiceStats } from '../components/ServiceStats';
import { useAuth } from '../contexts/AuthContext';

export default function AboutPage() {
  const { isAuthenticated } = useAuth();
  const features = [
    {
      title: 'Best N 成绩图片',
      description: '生成您的最佳 N 首歌曲成绩汇总图片，支持深色和白色主题，轻松分享您的游戏成就',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800',
      iconColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      title: '单曲成绩查询',
      description: '查询特定歌曲的详细成绩信息，包括准确率、连击数、评级等完整数据',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      ),
      color: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800',
      iconColor: 'text-green-600 dark:text-green-400'
    },
    {
      title: 'RKS 成绩列表',
      description: '查看所有歌曲的 RKS 计算详情，深入了解您的游戏水平和进步空间',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
      color: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800',
      iconColor: 'text-purple-600 dark:text-purple-400'
    },
    {
      title: '新曲速递',
      description: '及时获取最新曲目更新信息，了解新增歌曲的难度定数和谱面特性',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800',
      iconColor: 'text-orange-600 dark:text-orange-400'
    },
    {
      title: '玩家成绩渲染',
      description: '手动添加成绩并生成自定义 Best N 图片，适用于特殊场景下的成绩展示',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      color: 'from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 border-pink-200 dark:border-pink-800',
      iconColor: 'text-pink-600 dark:text-pink-400'
    },
    {
      title: 'RKS 计算器',
      description: '根据谱面定数和准确率计算单曲 RKS 值，帮助预估成绩提升空间',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
      color: 'from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20 border-cyan-200 dark:border-cyan-800',
      iconColor: 'text-cyan-600 dark:text-cyan-400'
    }
  ];

  const techStack = [
    { name: 'Next.js', icon: '⚡' },
    { name: 'React', icon: '⚛️' },
    { name: 'TypeScript', icon: '📘' },
    { name: 'Tailwind CSS', icon: '🎨' },
    { name: 'Vercel', icon: '▲' }
  ];

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950 text-gray-900 dark:text-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 px-4 lg:px-6 h-16 flex items-center backdrop-blur-sm bg-white/30 dark:bg-gray-900/30 border-b border-gray-200/50 dark:border-gray-700/50">
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
          {!isAuthenticated && (
            <Link
              href="/login"
              className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              登录
            </Link>
          )}
          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
          >
            控制台
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      {/* Main Content */}
      <main className="px-4 py-16">
        <div className="max-w-6xl mx-auto space-y-16">
          {/* Hero Section */}
          <section className="text-center space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              <span className="block bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                关于 Phigros 查询工具
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
              一站式 Phigros 游戏数据查询与可视化平台
              <br />
              为玩家提供专业、便捷、美观的成绩分析服务
            </p>
          </section>

          {/* Features Grid */}
          <section className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-4">核心功能</h2>
              <p className="text-gray-600 dark:text-gray-400">
                丰富的功能模块，满足您的各种查询需求
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className={`bg-gradient-to-br ${feature.color} rounded-2xl p-6 border shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105`}
                >
                  <div className="flex items-center mb-4">
                    <div className={`p-3 rounded-xl bg-white/50 dark:bg-gray-900/30 ${feature.iconColor} mr-3`}>
                      {feature.icon}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Service Stats */}
          <section className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-4">服务统计</h2>
              <p className="text-gray-600 dark:text-gray-400">
                实时更新的服务使用数据
              </p>
            </div>
            <ServiceStats />
          </section>

          {/* Tech Stack */}
          <section className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-4">技术栈</h2>
              <p className="text-gray-600 dark:text-gray-400">
                基于现代化前端技术构建
              </p>
            </div>
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl p-8 shadow-lg border border-gray-200/50 dark:border-gray-700/50">
              <div className="flex flex-wrap gap-4 justify-center">
                {techStack.map((tech, index) => (
                  <div
                    key={index}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-110 font-medium"
                  >
                    <span className="text-xl">{tech.icon}</span>
                    <span>{tech.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Support Links */}
          <section className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-4">服务支持</h2>
              <p className="text-gray-600 dark:text-gray-400">
                获取帮助与了解更多信息
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {supportLinks.map((section, index) => (
                <div
                  key={index}
                  className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-center mb-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 text-blue-600 dark:text-blue-400 mr-3">
                      {section.icon}
                    </div>
                    <h3 className="text-lg font-semibold">{section.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {section.links.map((link, linkIndex) => (
                      <li key={linkIndex}>
                        <a
                          href={link.url}
                          target={link.external ? '_blank' : undefined}
                          rel={link.external ? 'noopener noreferrer' : undefined}
                          className="inline-flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                        >
                          {link.name}
                          {link.external && (
                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          )}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Footer Info */}
          <section className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl p-8 shadow-lg border border-gray-200/50 dark:border-gray-700/50 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              由 <a href="https://github.com/Sczr0" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline dark:text-blue-400">弦塔</a> 提供技术支持
            </p>
            <div className="flex flex-wrap gap-4 justify-center items-center text-sm text-gray-500 dark:text-gray-400">
              <span>© 2024 Phigros Query</span>
              <span>·</span>
              <Link href="/agreement" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                用户协议
              </Link>
              <span>·</span>
              <span>All Rights Reserved</span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
