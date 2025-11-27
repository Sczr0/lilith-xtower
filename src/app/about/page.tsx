import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';
import { SimpleHeader } from '../components/SimpleHeader';
import { getPrecompiledAssetServer, hasPrecompiledAsset } from '../lib/precompiled-server';
import { AboutClientSections } from './components/AboutClientSections';

// 获取站点 URL
const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const SITE_URL = rawSiteUrl
  ? (rawSiteUrl.startsWith('http://') || rawSiteUrl.startsWith('https://')
      ? rawSiteUrl
      : `https://${rawSiteUrl}`)
  : 'https://lilith.xtower.site';

// 支持链接数据（静态）
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
      { name: '数据访问统计', url: 'https://cloud.umami.is/share/GquXbTjndnY5H0ts', external: true },
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

const AVATAR_SRC = '/about/avatar.png';

/**
 * 关于页面 - SSG 静态生成
 * 静态内容在服务端渲染，动态部分（平台检测、服务统计）由客户端组件处理
 */
export default async function AboutPage() {
  // 在服务端获取预编译的 About HTML
  let aboutHtml = '';
  let aboutError: string | null = null;

  try {
    const hasAbout = await hasPrecompiledAsset('about');
    if (hasAbout) {
      const { html } = await getPrecompiledAssetServer('about');
      aboutHtml = html;
    }
  } catch (e) {
    console.error('Failed to load about content:', e);
    aboutError = e instanceof Error ? e.message : String(e);
  }

  // BreadcrumbList 结构化数据
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: '首页',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '关于',
        item: `${SITE_URL}/about`,
      },
    ],
  };

  // Person 结构化数据 - 开发者信息
  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: '弦塔',
    jobTitle: 'Phigros Query 主要维护者',
    url: `${SITE_URL}/about`,
    image: `${SITE_URL}/about/avatar.png`,
    sameAs: [
      'https://github.com/Sczr0',
    ],
    worksFor: {
      '@type': 'Organization',
      name: 'Phigros Query',
      url: SITE_URL,
    },
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-50">
      {/* BreadcrumbList 结构化数据 */}
      <Script
        id="ld-json-breadcrumb-about"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
      />
      {/* Person 结构化数据 */}
      <Script
        id="ld-json-person"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personJsonLd),
        }}
      />
      {/* Header */}
      <SimpleHeader />

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

          {/* 可自填区域：从预编译 HTML 渲染 */}
          <section className="border border-gray-200 dark:border-neutral-800 rounded-xl p-4 sm:p-5">
            {aboutError ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                无法加载 About 内容（{aboutError}）。
              </div>
            ) : aboutHtml ? (
              <article className="prose prose-sm sm:prose dark:prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ __html: aboutHtml }} />
              </article>
            ) : (
              <div className="text-sm text-gray-400 dark:text-gray-500">暂无内容</div>
            )}
          </section>

          {/* 客户端动态部分：感谢服务提供商 + 服务统计 */}
          <AboutClientSections />

          {/* 服务支持（静态内容） */}
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
            © 2025 Phigros Query · <Link href="/agreement" className="hover:text-blue-600 dark:hover:text-blue-400">用户协议</Link> · <Link href="/privacy" className="hover:text-blue-600 dark:hover:text-blue-400">隐私协议</Link>
          </footer>
        </div>
      </main>
    </div>
  );
}
