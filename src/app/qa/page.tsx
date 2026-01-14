import Link from 'next/link';
import { SiteHeader } from '../components/SiteHeader';
import { PageShell } from '../components/PageShell';
import { buttonStyles } from '../components/ui/styles';
import { QAList } from './components/QAList';
import { getAllQA } from '../lib/qa';
import { safeJsonLdStringify } from '../lib/security/safeJsonLdStringify';
import { SITE_URL } from '../utils/site-url';
import { DEFAULT_QA_DATA } from './defaultQAData';
import type { QAItem } from './types';

// ISR: 每小时重新验证一次
export const revalidate = 3600;

/**
 * 常见问题页面 - SSR + ISR
 * 在服务端获取 QA 数据，每小时重新验证
 */
export default async function QAPage() {
  // 在服务端获取 QA 数据
  let qaData: QAItem[];
  
  try {
    const data = getAllQA();
    qaData = data && data.length > 0 ? data : DEFAULT_QA_DATA;
  } catch (error) {
    console.error('Failed to load QA data:', error);
    qaData = DEFAULT_QA_DATA;
  }

  // FAQPage 结构化数据 - 用于搜索引擎富媒体摘要
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qaData.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

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
        name: '常见问题',
        item: `${SITE_URL}/qa`,
      },
    ],
  };

  return (
    <PageShell
      variant="gradient"
      header={<SiteHeader />}
      mainClassName="relative z-10 flex-1 p-4 sm:p-6 lg:p-8"
      containerClassName="max-w-4xl mx-auto"
    >
      {/* FAQPage 结构化数据 */}
      <script
        type="application/ld+json"
        // 说明：JSON-LD 属于“无需执行的结构化数据”，随 HTML 输出可提升爬虫抓取稳定性。
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(faqJsonLd) }}
      />
      {/* BreadcrumbList 结构化数据 */}
      <script
        type="application/ld+json"
        // 说明：JSON-LD 属于“无需执行的结构化数据”，随 HTML 输出可提升爬虫抓取稳定性。
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbJsonLd) }}
      />
      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          常见问题
        </h1>
        <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400">
          快速找到您需要的答案
        </p>
      </div>

      {/* QA List (客户端交互组件) */}
      <QAList qaData={qaData} />

      {/* Contact Section */}
      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-2">
          没有找到答案？
        </h2>
        <p className="text-blue-700 dark:text-blue-300 mb-4">
          如果您的问题没有在这里找到答案，欢迎通过以下方式联系我们：
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="https://qm.qq.com/q/pbbOzU72aA"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonStyles({ variant: 'primary' })}
          >
            加入官方群聊 空间站「索终」
          </a>
          <Link
            href="/about"
            className={buttonStyles({ variant: 'primary' })}
          >
            查看关于页面
          </Link>
          <Link
            href="/"
            className={buttonStyles({ variant: 'outline' })}
          >
            返回主页
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
