import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Code2,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  Filter,
  KeyRound,
  LayoutDashboard,
  Link2,
  ListChecks,
  LockKeyhole,
  MessageCircleQuestion,
  RefreshCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  TerminalSquare,
} from 'lucide-react';

import { PageShell } from '../../../components/PageShell';
import { SiteHeader } from '../../../components/SiteHeader';
import { cx } from '../../../components/ui/styles';
import { getSliceBySlug, lilithSlices, sliceTypeLabels, type LilithSlice } from '../slices';

type SlicePageProps = {
  params: Promise<{ slug: string }>;
};

type Tone = 'neutral' | 'blue' | 'emerald' | 'amber' | 'red';

const metricRows = [
  { label: 'RKS', value: '16.21', delta: '+0.04' },
  { label: '平均 ACC', value: '99.31%', delta: '+0.18%' },
  { label: 'Phi', value: '12', delta: '+1' },
];

const scoreRows = [
  { title: 'Igallta', score: '1,000,000', acc: '100.00%', status: '已锁定' },
  { title: 'Rrhar\'il', score: '999,320', acc: '99.93%', status: '可导出' },
  { title: 'Distorted Fate', score: '998,860', acc: '99.88%', status: '需刷新' },
  { title: 'DESTRUCTION 3,2,1', score: '998,120', acc: '99.81%', status: '可导出' },
];

const consoleRows = [
  { name: 'web-production', scope: 'score:read', lastUsed: '2 分钟前', status: '正常' },
  { name: 'image-worker', scope: 'image:write', lastUsed: '昨天', status: '待轮换' },
  { name: 'local-test', scope: 'debug:read', lastUsed: '7 天前', status: '限制中' },
];

export function generateStaticParams() {
  return lilithSlices.map((slice) => ({ slug: slice.slug }));
}

export async function generateMetadata({ params }: SlicePageProps): Promise<Metadata> {
  const { slug } = await params;
  const slice = getSliceBySlug(slug);

  return {
    title: slice ? `${slice.shortTitle} UIUX 切片` : 'Lilith UIUX 切片',
    description: slice?.summary ?? 'Phigros Query UIUX 设计实验室切片详情。',
    robots: {
      index: false,
      follow: false,
    },
  };
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  const toneClassName =
    tone === 'blue'
      ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300'
      : tone === 'emerald'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300'
        : tone === 'amber'
          ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300'
          : tone === 'red'
            ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300'
            : 'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300';

  return (
    <span className={cx('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', toneClassName)}>
      {children}
    </span>
  );
}

function Panel({
  children,
  className,
  title,
  description,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cx('min-w-0 max-w-full overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900', className)}>
      {(title || description || action) && (
        <div className="flex flex-col gap-3 border-b border-neutral-100 px-4 py-4 dark:border-neutral-800 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">{title}</h2>}
            {description && <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-neutral-400">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function PrimaryButton({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-50 dark:bg-blue-500 dark:hover:bg-blue-400 dark:focus:ring-offset-neutral-950',
        className,
      )}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-700 dark:hover:bg-neutral-800 dark:focus:ring-offset-neutral-950',
        className,
      )}
    >
      {children}
    </button>
  );
}

function TextList({ items, tone = 'neutral' }: { items: string[]; tone?: Tone }) {
  const iconClassName =
    tone === 'red'
      ? 'text-red-600 dark:text-red-400'
      : tone === 'amber'
        ? 'text-amber-600 dark:text-amber-300'
        : tone === 'emerald'
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-blue-600 dark:text-blue-300';

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex min-w-0 gap-3 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          <CheckCircle2 className={cx('mt-1 size-4 shrink-0', iconClassName)} aria-hidden="true" />
          <span className="min-w-0 break-words">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SliceHero({ slice }: { slice: LilithSlice }) {
  const Icon = slice.icon;

  return (
    <header className="grid min-w-0 max-w-full gap-5 border-b border-neutral-200 pb-6 dark:border-neutral-800 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
      <div className="min-w-0">
        <Link
          href="/dev/lilith"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-neutral-500 transition hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-300"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          返回切片库
        </Link>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone="blue">{sliceTypeLabels[slice.type]}</Badge>
          <Badge tone={slice.slug === 'dashboard' ? 'red' : 'neutral'}>{slice.route}</Badge>
          {slice.slug === 'dashboard' && <Badge tone="amber">独立信息架构</Badge>}
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
          <span className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold text-neutral-950 dark:text-neutral-50 sm:text-3xl">{slice.title}</h1>
            <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-neutral-600 dark:text-neutral-400">{slice.summary}</p>
          </div>
        </div>
      </div>

      <div className="min-w-0 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">Primary task</p>
        <p className="mt-2 break-words text-sm leading-6 text-neutral-700 dark:text-neutral-300">{slice.primaryTask}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={slice.route}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-white dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            查看生产页
          </Link>
          <a
            href="#migration-boundary"
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            <ShieldAlert className="size-4" aria-hidden="true" />
            迁移边界
          </a>
        </div>
      </div>
    </header>
  );
}

function WorkspaceSlice({ slice }: { slice: LilithSlice }) {
  const tools = ['Best N', 'RKS 列表', '单曲查询', '历史记录'];

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
      <Panel title="工具导航" description="仪表盘桌面端先保证切换与上下文稳定。">
        <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-1">
          {tools.map((tool, index) => (
            <button
              key={tool}
              type="button"
              className={cx(
                'flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500',
                index === 0
                  ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800',
              )}
            >
              <span className="min-w-0 truncate">{tool}</span>
              <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
            </button>
          ))}
        </div>
      </Panel>

      <main className="min-w-0 space-y-6">
        <Panel
          title={slice.shortTitle}
          description="工作区不是单一表单：先展示数据可信度，再承载当前工具任务。"
          action={<Badge tone="emerald">上次同步 2 分钟前</Badge>}
        >
          <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {metricRows.map((metric) => (
                <div key={metric.label} className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{metric.label}</p>
                  <div className="mt-1 flex items-end justify-between gap-3">
                    <p className="text-xl font-semibold text-neutral-950 dark:text-neutral-50">{metric.value}</p>
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{metric.delta}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Database className="mt-1 size-4 shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">当前数据可用于导出</p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">导出前保留时间戳，刷新失败时回退到最近缓存。</p>
                </div>
              </div>
              <SecondaryButton>
                <RefreshCcw className="size-4" aria-hidden="true" />
                刷新
              </SecondaryButton>
            </div>

            <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
              <div className="hidden grid-cols-[minmax(0,1fr)_96px_80px_76px] gap-3 border-b border-neutral-100 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400 sm:grid">
                <span>曲目</span>
                <span>成绩</span>
                <span>ACC</span>
                <span className="text-right">状态</span>
              </div>
              {scoreRows.map((row) => (
                <div key={row.title} className="border-b border-neutral-100 px-3 py-3 last:border-b-0 dark:border-neutral-800">
                  <div className="space-y-2 sm:hidden">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-words text-sm font-medium text-neutral-900 dark:text-neutral-100">{row.title}</p>
                      <Badge tone={row.status === '需刷新' ? 'amber' : 'neutral'}>{row.status}</Badge>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{row.score} / {row.acc}</p>
                  </div>
                  <div className="hidden grid-cols-[minmax(0,1fr)_96px_80px_76px] gap-3 text-sm sm:grid">
                    <span className="truncate font-medium text-neutral-900 dark:text-neutral-100">{row.title}</span>
                    <span className="text-neutral-600 dark:text-neutral-400">{row.score}</span>
                    <span className="text-neutral-600 dark:text-neutral-400">{row.acc}</span>
                    <span className="text-right text-xs text-neutral-500 dark:text-neutral-400">{row.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </main>

      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Panel title="当前上下文">
          <div className="space-y-3 p-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm leading-6 text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-200">
              {slice.mobileStrategy}
            </div>
            <TextList items={slice.modules.slice(0, 4)} />
          </div>
        </Panel>
        <Panel title="迁移提醒">
          <div className="space-y-3 p-4">
            <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-6 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
              <AlertTriangle className="mt-1 size-4 shrink-0" aria-hidden="true" />
              <p>这张切片只证明工具台结构方向，不替换现有 Dashboard 业务组件。</p>
            </div>
            <SecondaryButton className="w-full">
              <ListChecks className="size-4" aria-hidden="true" />
              信息架构复核
            </SecondaryButton>
          </div>
        </Panel>
      </aside>
    </div>
  );
}

function GeneratorSlice({ slice }: { slice: LilithSlice }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <main className="min-w-0 space-y-6">
        <Panel
          title={`${slice.shortTitle} 工具切片`}
          description="生成器页面可以使用主任务 + 预览 + 轻量上下文栏，但仍要保持表单和预览尺寸稳定。"
        >
          <div className="grid gap-0 xl:grid-cols-[340px_minmax(0,1fr)]">
            <div className="space-y-4 border-b border-neutral-100 p-4 dark:border-neutral-800 xl:border-b-0 xl:border-r">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200" htmlFor="slice-source">
                  数据来源
                </label>
                <select id="slice-source" className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-800 dark:bg-neutral-950">
                  <option>当前登录成绩</option>
                  <option>手动输入测试数据</option>
                  <option>开放平台 API</option>
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200" htmlFor="slice-mode">
                    输出模式
                  </label>
                  <select id="slice-mode" className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-800 dark:bg-neutral-950">
                    <option>标准预览</option>
                    <option>分享图</option>
                    <option>调试输出</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200" htmlFor="slice-size">
                    导出尺寸
                  </label>
                  <select id="slice-size" className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-800 dark:bg-neutral-950">
                    <option>1600px</option>
                    <option>1200px</option>
                    <option>原始尺寸</option>
                  </select>
                </div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-6 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
                Demo 与正式工具必须有明确边界，避免用户误以为实验输出就是生产功能。
              </div>
            </div>

            <div className="min-w-0 p-4">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">预览</p>
                    <h2 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-neutral-50">{slice.shortTitle}</h2>
                  </div>
                  <Badge tone="blue">实验输出</Badge>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {metricRows.map((metric) => (
                    <div key={metric.label} className="rounded-md border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{metric.label}</p>
                      <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-neutral-50">{metric.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                  {scoreRows.slice(0, 3).map((row, index) => (
                    <div key={row.title} className="grid grid-cols-[32px_minmax(0,1fr)_76px] items-center gap-3 border-t border-neutral-100 px-3 py-3 first:border-t-0 dark:border-neutral-800">
                      <span className="text-sm font-medium text-neutral-400">#{index + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{row.title}</p>
                        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{row.score} / {row.acc}</p>
                      </div>
                      <Badge tone={index === 0 ? 'emerald' : 'neutral'}>{row.status}</Badge>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <PrimaryButton>
                    <Download className="size-4" aria-hidden="true" />
                    导出预览
                  </PrimaryButton>
                  <SecondaryButton>
                    <SlidersHorizontal className="size-4" aria-hidden="true" />
                    调整参数
                  </SecondaryButton>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </main>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Panel title="状态与帮助">
          <div className="space-y-3 p-4">
            <TextList items={slice.modules.slice(0, 4)} />
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm leading-6 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
              {slice.desktopStrategy}
            </div>
          </div>
        </Panel>
      </aside>
    </div>
  );
}

function ConsoleSlice({ slice }: { slice: LilithSlice }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <main className="min-w-0 space-y-6">
        <Panel title={`${slice.shortTitle} 控制台`} description="控制台页面优先保证表格、危险操作和文档上下文清楚。">
          <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">开发者状态</p>
                <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-neutral-50">已启用</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">凭证数量</p>
                <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-neutral-50">3</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-900/70 dark:bg-amber-950/30">
                <p className="text-xs text-amber-700 dark:text-amber-200">待处理风险</p>
                <p className="mt-1 text-lg font-semibold text-amber-900 dark:text-amber-100">1</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
              <div className="hidden grid-cols-[minmax(0,1fr)_120px_96px_76px] gap-3 border-b border-neutral-100 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400 sm:grid">
                <span>名称</span>
                <span>权限</span>
                <span>最近使用</span>
                <span className="text-right">状态</span>
              </div>
              {consoleRows.map((row) => (
                <div key={row.name} className="border-b border-neutral-100 px-3 py-3 last:border-b-0 dark:border-neutral-800">
                  <div className="space-y-2 sm:hidden">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-words text-sm font-medium text-neutral-900 dark:text-neutral-100">{row.name}</p>
                      <Badge tone={row.status === '待轮换' ? 'amber' : row.status === '限制中' ? 'red' : 'neutral'}>{row.status}</Badge>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{row.scope} / {row.lastUsed}</p>
                  </div>
                  <div className="hidden grid-cols-[minmax(0,1fr)_120px_96px_76px] gap-3 text-sm sm:grid">
                    <span className="truncate font-medium text-neutral-900 dark:text-neutral-100">{row.name}</span>
                    <span className="truncate text-neutral-600 dark:text-neutral-400">{row.scope}</span>
                    <span className="text-neutral-600 dark:text-neutral-400">{row.lastUsed}</span>
                    <span className="text-right text-xs text-neutral-500 dark:text-neutral-400">{row.status}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <PrimaryButton>
                <KeyRound className="size-4" aria-hidden="true" />
                创建凭证
              </PrimaryButton>
              <SecondaryButton>
                <TerminalSquare className="size-4" aria-hidden="true" />
                测试接口
              </SecondaryButton>
            </div>
          </div>
        </Panel>
      </main>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Panel title="安全上下文">
          <div className="space-y-3 p-4">
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-6 text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200">
              <ShieldAlert className="mt-1 size-4 shrink-0" aria-hidden="true" />
              <p>危险操作必须使用站内确认弹窗，不使用 window.confirm 或 prompt。</p>
            </div>
            <TextList items={slice.modules.slice(0, 4)} tone="amber" />
          </div>
        </Panel>
        <Panel title="文档入口">
          <div className="space-y-2 p-4">
            {slice.interactions.slice(0, 3).map((item) => (
              <button key={item} type="button" className="flex w-full items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2 text-left text-sm text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
                <span>{item}</span>
                <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
              </button>
            ))}
          </div>
        </Panel>
      </aside>
    </div>
  );
}

function AuthSlice({ slice }: { slice: LilithSlice }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      <Panel title="登录方式" description="流程页先稳定主动作，再把安全说明放到可扫读的右侧。">
        <div className="space-y-4 p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300">二维码</button>
            <button type="button" className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">Token</button>
          </div>
          <div className="flex aspect-square max-h-[280px] min-h-[220px] items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950">
            <div className="text-center">
              <LockKeyhole className="mx-auto size-8 text-neutral-400" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-neutral-800 dark:text-neutral-200">等待生成登录凭证</p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">区域尺寸固定，避免状态切换时页面跳动。</p>
            </div>
          </div>
          <PrimaryButton className="w-full">
            <RefreshCcw className="size-4" aria-hidden="true" />
            刷新登录状态
          </PrimaryButton>
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel title="安全与失败恢复">
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
              <ShieldAlert className="mb-2 size-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">敏感输入明确可控</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">显示、隐藏、清除和过期状态必须靠近输入区。</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
              <MessageCircleQuestion className="mb-2 size-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">失败要给下一步</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">过期、拒绝、网络错误都需要重试或返回入口。</p>
            </div>
          </div>
        </Panel>
        <Panel title="模块清单">
          <div className="p-4">
            <TextList items={slice.modules} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ContentSlice({ slice }: { slice: LilithSlice }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Panel title="筛选与入口">
        <div className="space-y-4 p-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input className="h-10 w-full rounded-md border border-neutral-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-800 dark:bg-neutral-950" placeholder="搜索内容" />
          </label>
          <div className="space-y-2">
            {slice.modules.slice(0, 5).map((module, index) => (
              <button
                key={module}
                type="button"
                className={cx(
                  'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm',
                  index === 0
                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300'
                    : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
                )}
              >
                <span>{module}</span>
                <Filter className="size-4" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title={slice.shortTitle} description={slice.desktopStrategy}>
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {slice.interactions.map((item) => (
            <article key={item} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <BookOpen className="mb-3 size-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">{item}</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">内容页用结构提高可扫读性，不靠大卡片和长 hero 填满桌面。</p>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function DocumentSlice({ slice }: { slice: LilithSlice }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,780px)_280px] lg:justify-center">
      <Panel title={slice.shortTitle} description="文档页正文不拉满宽屏，桌面空位交给目录、更新时间和相关入口。">
        <article className="space-y-6 p-5 text-sm leading-7 text-neutral-700 dark:text-neutral-300">
          {slice.modules.slice(0, 4).map((module, index) => (
            <section key={module}>
              <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">{index + 1}. {module}</h2>
              <p className="mt-2">
                这一段用于定义 {module} 的阅读结构。生产迁移时应保留正文宽度、目录锚点、更新时间和相关协议入口，避免把协议页做成全宽长文。
              </p>
            </section>
          ))}
        </article>
      </Panel>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Panel title="目录">
          <nav className="space-y-1 p-3">
            {slice.modules.slice(0, 5).map((module) => (
              <a key={module} href="#migration-boundary" className="block rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-blue-600 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-blue-300">
                {module}
              </a>
            ))}
          </nav>
        </Panel>
        <Panel title="元信息">
          <div className="space-y-3 p-4 text-sm text-neutral-600 dark:text-neutral-400">
            <p>更新时间：2026-06-02</p>
            <p>状态：设计切片</p>
            <Badge tone="amber">正文不可拉宽</Badge>
          </div>
        </Panel>
      </aside>
    </div>
  );
}

function StatusSlice({ slice }: { slice: LilithSlice }) {
  return (
    <div className="mx-auto grid max-w-[960px] gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <Panel>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="size-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-neutral-950 dark:text-neutral-50">{slice.shortTitle} 状态</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{slice.primaryTask}</p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <PrimaryButton>
                  <RefreshCcw className="size-4" aria-hidden="true" />
                  重试
                </PrimaryButton>
                <SecondaryButton>
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  返回入口
                </SecondaryButton>
              </div>
            </div>
          </div>
        </div>
      </Panel>
      <Panel title="下一步">
        <div className="p-4">
          <TextList items={slice.modules} tone="amber" />
        </div>
      </Panel>
    </div>
  );
}

function RedirectSlice({ slice }: { slice: LilithSlice }) {
  return (
    <div className="mx-auto max-w-[760px]">
      <Panel title={slice.shortTitle} description="跳转页必须轻量，但不能在失败时留空白。">
        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">目标</p>
            <div className="mt-2 flex items-center gap-2 text-sm font-medium text-neutral-950 dark:text-neutral-50">
              <Link2 className="size-4 text-blue-600 dark:text-blue-300" aria-hidden="true" />
              <span className="min-w-0 truncate">https://example.xtower.site/path</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <PrimaryButton>
              <ExternalLink className="size-4" aria-hidden="true" />
              继续访问
            </PrimaryButton>
            <SecondaryButton>
              <Copy className="size-4" aria-hidden="true" />
              复制链接
            </SecondaryButton>
          </div>
          <TextList items={slice.modules} />
        </div>
      </Panel>
    </div>
  );
}

function DebugSlice({ slice }: { slice: LilithSlice }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel title="调试输入" description="调试页要区分输入、结果和安全说明，敏感字段默认不展示。">
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="space-y-3">
            <input className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-800 dark:bg-neutral-950" placeholder="请求 ID 或会话摘要" />
            <PrimaryButton>
              <TerminalSquare className="size-4" aria-hidden="true" />
              运行诊断
            </PrimaryButton>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
            <Code2 className="mb-2 size-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
            <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">响应摘要</p>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">敏感字段已脱敏，完整输出需要显式 reveal。</p>
          </div>
        </div>
      </Panel>
      <Panel title="安全边界">
        <div className="p-4">
          <TextList items={slice.boundaries} tone="red" />
        </div>
      </Panel>
    </div>
  );
}

function CommunitySlice({ slice }: { slice: LilithSlice }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel title={slice.shortTitle} description={slice.primaryTask}>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/70 dark:bg-blue-950/30">
            <Sparkles className="mb-3 size-5 text-blue-700 dark:text-blue-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-100">支持与参与</h2>
            <p className="mt-2 text-sm leading-6 text-blue-800 dark:text-blue-200">社区页要说清目的、规则和安全外链，不做广告式 hero。</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <ExternalLink className="mb-3 size-5 text-neutral-600 dark:text-neutral-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">外链透明</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">按钮必须展示目标和风险，必要时经 /go 中转。</p>
          </div>
        </div>
      </Panel>
      <Panel title="规则摘要">
        <div className="p-4">
          <TextList items={slice.modules} />
        </div>
      </Panel>
    </div>
  );
}

function LandingSlice({ slice }: { slice: LilithSlice }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel title="工作台入口" description="首页首屏要给下一步，不做纯营销落地页。">
        <div className="grid gap-4 p-4 md:grid-cols-2">
          {slice.modules.map((module, index) => (
            <Link key={module} href={index === 0 ? '/login' : '/dashboard'} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 transition hover:border-blue-300 hover:bg-blue-50/40 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-blue-800 dark:hover:bg-blue-950/20">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">{module}</p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">直接进入任务，不用大 hero 填满首屏。</p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </Panel>
      <Panel title="首页边界">
        <div className="p-4">
          <TextList items={slice.boundaries} tone="amber" />
        </div>
      </Panel>
    </div>
  );
}

function TypeSpecificSlice({ slice }: { slice: LilithSlice }) {
  switch (slice.type) {
    case 'workspace':
      return <WorkspaceSlice slice={slice} />;
    case 'generator':
      return <GeneratorSlice slice={slice} />;
    case 'console':
      return <ConsoleSlice slice={slice} />;
    case 'auth':
      return <AuthSlice slice={slice} />;
    case 'content':
      return <ContentSlice slice={slice} />;
    case 'document':
      return <DocumentSlice slice={slice} />;
    case 'status':
      return <StatusSlice slice={slice} />;
    case 'redirect':
      return <RedirectSlice slice={slice} />;
    case 'debug':
      return <DebugSlice slice={slice} />;
    case 'community':
      return <CommunitySlice slice={slice} />;
    case 'landing':
      return <LandingSlice slice={slice} />;
    default:
      return null;
  }
}

function MigrationBoundary({ slice }: { slice: LilithSlice }) {
  return (
    <section id="migration-boundary" className="grid scroll-mt-20 gap-6 lg:grid-cols-3">
      <Panel title="模块关系">
        <div className="p-4">
          <TextList items={slice.modules} />
        </div>
      </Panel>
      <Panel title="交互要求">
        <div className="p-4">
          <TextList items={slice.interactions} tone="emerald" />
        </div>
      </Panel>
      <Panel title="迁移禁区">
        <div className="p-4">
          <TextList items={slice.boundaries} tone="red" />
        </div>
      </Panel>
    </section>
  );
}

function StrategyPanel({ slice }: { slice: LilithSlice }) {
  return (
    <Panel title="响应式策略" description="这里记录切片的布局判断，不等同于生产页面最终方案。">
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-neutral-100 p-4 dark:border-neutral-800 md:border-b-0 md:border-r">
          <LayoutDashboard className="mb-3 size-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">桌面端</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{slice.desktopStrategy}</p>
        </div>
        <div className="p-4">
          <Eye className="mb-3 size-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">移动端</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{slice.mobileStrategy}</p>
        </div>
      </div>
    </Panel>
  );
}

export default async function LilithSlicePage({ params }: SlicePageProps) {
  const { slug } = await params;
  const slice = getSliceBySlug(slug);

  if (!slice) {
    notFound();
  }

  return (
    <PageShell
      variant="plain"
      header={<SiteHeader brandLabel="Lilith 设计实验室" brandHref="/dev/lilith" links={[]} showLogin={false} showLogout={false} enableMobileMenu={false} />}
      mainClassName="min-h-[calc(100vh-3.5rem)] bg-neutral-50 px-4 py-6 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50 sm:px-6 lg:py-8"
      containerClassName="mx-auto max-w-[1280px]"
      footerVariant="none"
    >
      <div className="min-w-0 space-y-6">
        <SliceHero slice={slice} />
        <TypeSpecificSlice slice={slice} />
        <StrategyPanel slice={slice} />
        <MigrationBoundary slice={slice} />
      </div>
    </PageShell>
  );
}
