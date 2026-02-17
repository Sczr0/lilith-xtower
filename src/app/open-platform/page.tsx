import type { Metadata } from 'next';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, BookOpenText, ChartColumnIncreasing, Music4, ScanQrCode, ShieldCheck, Trophy } from 'lucide-react';
import { PageShell } from '../components/PageShell';
import { SiteHeader } from '../components/SiteHeader';
import { buttonStyles, cardStyles } from '../components/ui/styles';
import { safeJsonLdStringify } from '../lib/security/safeJsonLdStringify';
import { SITE_URL } from '../utils/site-url';
import { buildGoHref } from '../utils/outbound';
import { OpenPlatformAuthPanel } from './components/OpenPlatformAuthPanel';
import { OpenPlatformApiKeysPanel } from './components/OpenPlatformApiKeysPanel';

const OPEN_API_DOC_URL = 'https://s.apifox.cn/67f5ad8d-931b-429e-b456-e9dea1161e77/llms.txt';

type Capability = {
  title: string;
  description: string;
  endpoint: string;
  icon: LucideIcon;
};

const CAPABILITIES: Capability[] = [
  {
    title: 'TapTap 扫码登录',
    description: '提供标准化扫码会话创建与状态轮询，便于 Web 与工具端快速接入。',
    endpoint: 'POST /v1/auth/taptap/qr-sessions',
    icon: ScanQrCode,
  },
  {
    title: 'B30 查询',
    description: '支持按玩家或当前授权身份查询 B30 数据，便于构建个人数据看板。',
    endpoint: 'GET /v1/players/{player_id}/b30',
    icon: ChartColumnIncreasing,
  },
  {
    title: '课题查询',
    description: '提供课题进度与结果读取能力，适用于社区活动、机器人与自定义工具。',
    endpoint: 'GET /v1/players/{player_id}/topics',
    icon: BookOpenText,
  },
  {
    title: '排行榜',
    description: '开放榜单定义与条目查询，适合做榜单展示、统计分析与榜单快照。',
    endpoint: 'GET /v1/leaderboards/{board_id}/entries',
    icon: Trophy,
  },
  {
    title: '新曲速递',
    description: '聚合最新曲目更新内容，支持缓存与增量拉取，便于站点和机器人同步展示。',
    endpoint: 'GET /v1/song-updates',
    icon: Music4,
  },
  {
    title: '平台治理',
    description: '统一 API Key、限流、版本化与请求追踪，降低开放接口长期维护风险。',
    endpoint: 'GET /v1/meta/version',
    icon: ShieldCheck,
  },
];

const QUICK_STEPS = [
  '创建开发者凭证（API Key），配置调用域名与来源。',
  '按接口文档完成请求签名与限流规范接入。',
  '先接入公共只读接口，再逐步接入用户授权能力。',
  '通过 request_id 对接日志，快速定位线上问题。',
];

const ENDPOINT_PREVIEW = `GET /v1/song-updates
GET /v1/leaderboards/{board_id}/entries?page=1&page_size=20
GET /v1/players/{player_id}/b30`;

const RESPONSE_PREVIEW = `{
  "request_id": "01JXXXXX",
  "code": "OK",
  "message": "success",
  "data": {}
}`;

export const metadata: Metadata = {
  title: '开放平台 | Phigros Query',
  description: 'Phigros Query 开放平台主页：提供 TapTap 扫码登录、B30 查询、课题查询、排行榜与新曲速递能力。',
  alternates: {
    canonical: '/open-platform',
  },
  openGraph: {
    type: 'website',
    url: '/open-platform',
    title: '开放平台 | Phigros Query',
    description: '为开发者提供统一、稳定的 Phigros 数据能力接入入口。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '开放平台 | Phigros Query',
    description: '为开发者提供统一、稳定的 Phigros 数据能力接入入口。',
    images: ['/og'],
  },
};

export default function OpenPlatformPage() {
  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Phigros Query Open Platform',
    url: `${SITE_URL}/open-platform`,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'CNY',
    },
  };

  return (
    <PageShell
      variant="gradient"
      header={<SiteHeader />}
      beforeMain={
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(softwareJsonLd) }}
        />
      }
    >
      <div className="space-y-8 sm:space-y-10">
        <section className={cardStyles({ tone: 'glass', padding: 'lg', className: 'relative overflow-hidden' })}>
          <div className="absolute inset-y-0 right-0 hidden sm:block w-1/2 bg-gradient-to-l from-blue-100/70 to-transparent dark:from-blue-900/20" />
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center rounded-full border border-blue-200/80 dark:border-blue-900/60 bg-white/60 dark:bg-neutral-900/60 px-3 py-1 text-xs sm:text-sm text-blue-700 dark:text-blue-300">
              开放平台 · Open Platform
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">面向开发者的统一接入入口</h1>
            <p className="max-w-2xl text-sm sm:text-base text-gray-600 dark:text-gray-300">
              在单一 API 版本下快速接入 TapTap 扫码登录、B30 查询、课题查询、排行榜和新曲速递能力，
              用统一鉴权、限流和错误码规范降低集成成本。
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={buildGoHref(OPEN_API_DOC_URL) ?? OPEN_API_DOC_URL}
                target="_blank"
                rel="noreferrer"
                className={buttonStyles({ size: 'lg', variant: 'primary' })}
              >
                查看接口文档
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a href="/unified-api-dashboard" className={buttonStyles({ size: 'lg', variant: 'outline' })}>
                进入开发者仪表盘
              </a>
            </div>
          </div>
        </section>

        <OpenPlatformAuthPanel />
        <OpenPlatformApiKeysPanel />

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CAPABILITIES.map((capability) => {
            const Icon = capability.icon;
            return (
              <article key={capability.title} className={cardStyles({ padding: 'sm' })}>
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="text-base sm:text-lg font-semibold">{capability.title}</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{capability.description}</p>
                <p className="mt-3 text-xs font-mono text-gray-500 dark:text-gray-500 break-all">{capability.endpoint}</p>
              </article>
            );
          })}
        </section>

        <section className={cardStyles({ padding: 'md' })}>
          <h2 className="text-xl font-semibold">快速开始</h2>
          <ol className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {QUICK_STEPS.map((step, index) => (
              <li key={step} className="rounded-lg border border-gray-200 dark:border-neutral-800 p-4">
                <div className="text-xs text-gray-500 dark:text-gray-500">{index + 1}</div>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <article className={cardStyles({ padding: 'sm' })}>
            <h3 className="text-base font-semibold">请求示例</h3>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 p-3 text-xs text-gray-700 dark:text-gray-300">
              <code>{ENDPOINT_PREVIEW}</code>
            </pre>
          </article>
          <article className={cardStyles({ padding: 'sm' })}>
            <h3 className="text-base font-semibold">响应结构</h3>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 p-3 text-xs text-gray-700 dark:text-gray-300">
              <code>{RESPONSE_PREVIEW}</code>
            </pre>
          </article>
        </section>
      </div>
    </PageShell>
  );
}
