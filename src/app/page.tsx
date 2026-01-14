import type { Metadata } from 'next';
import { BarChart3, Image as ImageIcon, List } from 'lucide-react';
import { SiteHeader } from './components/SiteHeader';
import { HomeStartButton } from './components/HomeStartButton';
import { PreloadLinks } from './components/PreloadLinks';
import { PageShell } from './components/PageShell';
import { buttonStyles, cardStyles } from './components/ui/styles';
import { safeJsonLdStringify } from './lib/security/safeJsonLdStringify';
import { SITE_URL } from './utils/site-url';

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

/**
 * 首页 - SSG 静态生成
 * 结构化数据在服务端渲染，Header 由客户端组件处理登录状态。
 */
export default function Home() {
  // 结构化数据（WebSite + Organization）
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'Phigros Query',
        url: SITE_URL,
        description: 'Phigros Query 是面向 Phigros 玩家的成绩查询与数据分析工具，支持 RKS 计算、Best N 成绩卡、单曲成绩查询与分享。',
        publisher: {
          '@id': `${SITE_URL}/#organization`,
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_URL}/qa?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Phigros Query',
        alternateName: '空间站「塔弦」',
        url: SITE_URL,
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_URL}/about/avatar.png`,
          width: 512,
          height: 512,
        },
        description: '由空间站「塔弦」制作的 Phigros 成绩查询与分享工具，提供 RKS 计算、Best N 查询、成绩卡片生成等功能。',
        sameAs: ['https://github.com/Sczr0', 'https://afdian.com/a/xtower'],
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          url: 'https://qm.qq.com/q/YQMW1eiz8m',
        },
      },
    ],
  };

  return (
    <PageShell
      variant="plain"
      header={<SiteHeader />}
      beforeMain={
        <>
          <script
            type="application/ld+json"
            // 说明：JSON-LD 属于“无需执行的结构化数据”，随 HTML 输出可提升爬虫抓取稳定性。
            dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
          />

          {/* 预加载关键路由和资源 */}
          <PreloadLinks />
        </>
      }
    >
      <div className="space-y-10">
        {/* 简洁 Hero */}
        <section className="text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Phigros Query - 不专业的成绩查询与数据分析</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            查询成绩、生成图片、分析数据，欢迎来到空间站「塔弦」旗下的 Phigros Query。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <HomeStartButton className={buttonStyles({ size: 'lg', variant: 'primary' })} />
            <a href="#features" className={buttonStyles({ size: 'lg', variant: 'outline' })}>
              了解更多
            </a>
          </div>
        </section>

        {/* 功能概览 */}
        <section id="features" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={cardStyles({ padding: 'sm' })}>
            <div className="mb-3 flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold mb-1">Best N 成绩卡</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">生成最强 N 首曲目的成绩汇总图片，支持深/浅色主题。</p>
          </div>
          <div className={cardStyles({ padding: 'sm' })}>
            <div className="mb-3 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold mb-1">单曲成绩查询</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">查看单曲成绩详情：准确率、连击、评级与难度表现。</p>
          </div>
          <div className={cardStyles({ padding: 'sm' })}>
            <div className="mb-3 flex items-center justify-center">
              <List className="w-6 h-6 text-green-600 dark:text-green-400" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold mb-1">RKS 成绩列表</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">快速查看 RKS 计算细节，洞察提升空间与目标分数。</p>
          </div>
        </section>

        {/* 使用指引 */}
        <section className={cardStyles({ padding: 'sm', className: 'p-4 sm:p-5' })}>
          <h2 className="text-lg font-semibold mb-4">如何使用</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500 dark:text-gray-400 mb-1">1</div>
              <p className="text-gray-700 dark:text-gray-300">选择登录方式（扫码 / SessionToken / API）。</p>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400 mb-1">2</div>
              <p className="text-gray-700 dark:text-gray-300">完成验证，系统自动拉取最新成绩数据。</p>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400 mb-1">3</div>
              <p className="text-gray-700 dark:text-gray-300">在控制台选择功能开始查询或生成图片。</p>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400 mb-1">4</div>
              <p className="text-gray-700 dark:text-gray-300">导出图片/数据，便捷分享与保存。</p>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
