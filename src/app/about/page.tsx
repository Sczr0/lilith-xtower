import Image from 'next/image';
import { PageShell } from '../components/PageShell';
import { SiteHeader } from '../components/SiteHeader';
import { getPrecompiledAssetServer, hasPrecompiledAsset } from '../lib/precompiled-server';
import { safeJsonLdStringify } from '../lib/security/safeJsonLdStringify';
import { SITE_URL } from '../utils/site-url';
import { AboutClientSections } from './components/AboutClientSections';
import { SUPPORT_LINK_SECTIONS } from './supportLinks';

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
    sameAs: ['https://github.com/Sczr0'],
    worksFor: {
      '@type': 'Organization',
      name: 'Phigros Query',
      url: SITE_URL,
    },
  };

  return (
    <PageShell
      variant="plain"
      header={<SiteHeader />}
      beforeMain={
        <>
          {/* BreadcrumbList 结构化数据 */}
          <script
            type="application/ld+json"
            // 说明：JSON-LD 属于“无需执行的结构化数据”，随 HTML 输出可提升爬虫抓取稳定性。
            dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbJsonLd) }}
          />

          {/* Person 结构化数据 */}
          <script
            type="application/ld+json"
            // 说明：JSON-LD 属于“无需执行的结构化数据”，随 HTML 输出可提升爬虫抓取稳定性。
            dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(personJsonLd) }}
          />
        </>
      }
    >
      <div className="space-y-10">
        {/* 顶部：头像 + 昵称（聊天软件风格） */}
        <section className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="h-16 w-16 rounded-full overflow-hidden bg-gray-100 dark:bg-neutral-800">
            <Image
              src={AVATAR_SRC}
              alt="弦塔头像"
              width={64}
              height={64}
              className="h-16 w-16 rounded-full object-cover object-center"
              priority
            />
          </div>
          <div className="text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">弦塔</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Phigros 查询 · 主要（现在是唯一）维护者</p>
          </div>
        </section>

        {/* 可自填区域：从预编译 HTML 渲染 */}
        <section className="border border-gray-200 dark:border-neutral-800 rounded-xl p-4 sm:p-5">
          {aboutError ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">无法加载 About 内容，请稍后重试。</div>
          ) : aboutHtml ? (
            <article className="prose prose-sm sm:prose dark:prose-invert max-w-none">
              {/* 安全约束：仅允许渲染来自“预编译 + sanitize-html 白名单净化”的本地产物，禁止绕开该链路渲染外部 HTML。 */}
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
            {SUPPORT_LINK_SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <div key={section.title} className="border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400">
                      <Icon className="w-6 h-6" aria-hidden="true" />
                    </span>
                    <h3 className="text-base font-medium">{section.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {section.links.map((link) => (
                      <li key={link.url}>
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
              );
            })}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
