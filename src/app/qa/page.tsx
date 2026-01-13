import Link from 'next/link';
import { SiteHeader } from '../components/SiteHeader';
import { PageShell } from '../components/PageShell';
import { buttonStyles } from '../components/ui/styles';
import { QAList } from './components/QAList';
import { getAllQA } from '../lib/qa';
import { SITE_URL } from '../utils/site-url';

// ISR: 每小时重新验证一次
export const revalidate = 3600;

interface QAItem {
  id: string;
  question: string;
  answer: string;
  category: 'login' | 'usage' | 'technical' | 'security';
}

// 默认的 QA 数据（作为回退）
const defaultQAData: QAItem[] = [
  {
    id: 'q1',
    question: '如何获取 SessionToken？',
    answer: 'Phigros 游戏内没有直接获取 SessionToken 的方式。为了降低凭证泄露风险，本网站默认不会在前端展示原始 SessionToken/API Token。你可以通过扫码登录或联合查分 API 登录后，在 /auth 查看当前登录状态（仅显示脱敏摘要）。若确有排查需求，请仅在自己可控环境下开启调试入口（生产默认关闭），并避免分享截图。',
    category: 'login',
  },
  {
    id: 'q2',
    question: '支持哪些登录方式？',
    answer: '我们支持多种登录方式：\n1. 扫码登录：使用 TapTap App 扫码登录\n2. 手动登录：输入 SessionToken\n3. 联合查分 API：使用 API 凭证登录\n4. 联合查分平台：使用平台账号登录',
    category: 'login',
  },
  {
    id: 'q3',
    question: '登录凭证会保存多久？',
    answer: '登录态通过 HttpOnly Cookie 会话保存（浏览器脚本无法直接读取），除非您主动退出登录或清除站点 Cookie/数据，否则会保持登录状态。',
    category: 'security',
  },
  {
    id: 'q4',
    question: '如何生成 Best N 成绩图片？',
    answer: '登录后，在侧边栏选择"BN 图片生成"，选择您想要的主题（深色/白色）和歌曲数量，点击生成即可。生成的图片可以直接下载或分享。',
    category: 'usage',
  },
  {
    id: 'q5',
    question: '什么是 RKS？',
    answer: 'RKS (Ranking Score) 是 Phigros 中衡量玩家水平的指标。它基于玩家最佳 N 首歌曲的成绩计算得出。您可以在"RKS 成绩列表"中查看详细的 RKS 计算信息。',
    category: 'usage',
  },
  {
    id: 'q6',
    question: '我的数据安全吗？',
    answer: '我们不会在浏览器 localStorage 中保存 SessionToken/API Token 等原始凭证；登录态使用服务端加密的 HttpOnly 会话 Cookie。页面可能会使用浏览器端的短期缓存提升体验（例如列表缓存），您可以随时通过退出登录或清理站点数据来移除本地缓存。',
    category: 'security',
  },
  {
    id: 'q7',
    question: '为什么我的成绩数据没有更新？',
    answer: '成绩数据来自 Phigros 官方服务器。如果您刚完成游戏，可能需要等待一段时间才会同步到服务器。您可以尝试退出登录后重新登录来刷新数据。',
    category: 'technical',
  },
  {
    id: 'q8',
    question: '支持哪些浏览器？',
    answer: '我们建议使用最新版本的 Chrome、Firefox、Safari 或 Edge 浏览器以获得最佳体验。部分功能可能不支持较旧的浏览器版本。',
    category: 'technical',
  },
  {
    id: 'q9',
    question: '如何查看调试信息？',
    answer: '登录后，在登录页面会显示当前登录状态，点击“查看详情”可查看会话摘要信息；也可以访问 /auth 查看当前会话状态。/debug-auth 为受控调试入口，生产环境默认不可用。',
    category: 'technical',
  },
  {
    id: 'q10',
    question: '可以同时使用多个账号吗？',
    answer: '目前不支持同时登录多个账号。如果您需要切换账号，请先退出当前账号，然后使用新的凭证登录。',
    category: 'usage',
  },
];

/**
 * 常见问题页面 - SSR + ISR
 * 在服务端获取 QA 数据，每小时重新验证
 */
export default async function QAPage() {
  // 在服务端获取 QA 数据
  let qaData: QAItem[];
  
  try {
    const data = getAllQA();
    qaData = data && data.length > 0 ? data : defaultQAData;
  } catch (error) {
    console.error('Failed to load QA data:', error);
    qaData = defaultQAData;
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
    <PageShell variant="gradient" main={false}>
      {/* FAQPage 结构化数据 */}
      <script
        type="application/ld+json"
        // 说明：JSON-LD 属于“无需执行的结构化数据”，随 HTML 输出可提升爬虫抓取稳定性。
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {/* BreadcrumbList 结构化数据 */}
      <script
        type="application/ld+json"
        // 说明：JSON-LD 属于“无需执行的结构化数据”，随 HTML 输出可提升爬虫抓取稳定性。
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Header */}
      <SiteHeader />

      {/* Main Content */}
      <main className="relative z-10 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
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
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex items-center justify-center h-16 backdrop-blur-sm bg-white/30 dark:bg-gray-900/30 border-t border-gray-200/50 dark:border-gray-700/50 mt-8">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          © 2025 Phigros Query. All Rights Reserved.
        </p>
      </footer>
    </PageShell>
  );
}
