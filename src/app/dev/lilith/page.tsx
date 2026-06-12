import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  LayoutDashboard,
  Palette,
  Route,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

import { PageShell } from '../../components/PageShell';
import { SiteHeader } from '../../components/SiteHeader';
import { cx } from '../../components/ui/styles';
import { lilithSlices, sliceTypeLabels, type LilithSlice, type LilithSliceType } from './slices';

export const metadata: Metadata = {
  title: 'Lilith UIUX 设计实验室',
  description: 'Phigros Query 全站 UIUX 风格切片库，用于审查视觉语气与页面类型，不作为生产迁移蓝图。',
  robots: {
    index: false,
    follow: false,
  },
};

type Tone = 'neutral' | 'blue' | 'emerald' | 'amber' | 'red';

const typeOrder: LilithSliceType[] = [
  'workspace',
  'generator',
  'console',
  'auth',
  'content',
  'document',
  'status',
  'redirect',
  'debug',
  'community',
  'landing',
];

const borrowRules = [
  '浅灰页面背景、白色面板、细边框、低阴影。',
  '小字号层级、8px 左右圆角、蓝色只用于操作与焦点。',
  '状态、表单、预览、导出动作之间的低噪音关系。',
];

const blockedRules = [
  '不得把普通生成器两栏结构套到 Dashboard、排行榜或开放平台。',
  '不得为了“干净”删除生产页已有筛选、历史、批量动作和状态反馈。',
  '不得先套样式再补信息架构；复杂页面必须先重画任务流。',
];

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
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
}) {
  return (
    <section className={cx('rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900', className)}>
      {(title || description) && (
        <div className="border-b border-neutral-100 px-4 py-4 dark:border-neutral-800">
          {title && <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">{title}</h2>}
          {description && <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-neutral-400">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

function RuleList({ items, tone }: { items: string[]; tone: 'good' | 'bad' }) {
  const Icon = tone === 'good' ? CheckCircle2 : CircleAlert;
  const iconClassName = tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-300';

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          <Icon className={cx('mt-1 size-4 shrink-0', iconClassName)} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function TypeStat({ type, count }: { type: LilithSliceType; count: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{sliceTypeLabels[type]}</p>
      <p className="mt-1 text-xl font-semibold text-neutral-950 dark:text-neutral-50">{count}</p>
    </div>
  );
}

function SliceCard({ slice }: { slice: LilithSlice }) {
  const Icon = slice.icon;
  const isDashboard = slice.slug === 'dashboard';

  return (
    <Link
      href={`/dev/lilith/${slice.slug}`}
      className="group flex min-h-full flex-col rounded-lg border border-neutral-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-neutral-950 dark:text-neutral-50">{slice.shortTitle}</h3>
            <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">{slice.route}</p>
          </div>
        </div>
        <ArrowRight className="mt-1 size-4 shrink-0 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-300" aria-hidden="true" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone={isDashboard ? 'amber' : 'neutral'}>{sliceTypeLabels[slice.type]}</Badge>
        {isDashboard && <Badge tone="red">不可照搬</Badge>}
      </div>

      <p className="mt-3 line-clamp-3 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{slice.primaryTask}</p>
      <p className="mt-auto pt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-500">{slice.desktopStrategy}</p>
    </Link>
  );
}

export default function LilithDevPage() {
  const typeCounts = typeOrder.map((type) => ({
    type,
    count: lilithSlices.filter((slice) => slice.type === type).length,
  })).filter(({ count }) => count > 0);

  const groupedSlices = typeOrder.map((type) => ({
    type,
    slices: lilithSlices.filter((slice) => slice.type === type),
  })).filter(({ slices }) => slices.length > 0);

  return (
    <PageShell
      variant="plain"
      header={<SiteHeader brandLabel="Lilith 设计实验室" brandHref="/dev/lilith" links={[]} showLogin={false} showLogout={false} enableMobileMenu={false} />}
      mainClassName="min-h-[calc(100vh-3.5rem)] bg-neutral-50 px-4 py-6 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50 sm:px-6 lg:py-8"
      containerClassName="mx-auto max-w-[1280px]"
      footerVariant="none"
    >
      <div className="space-y-6">
        <header className="grid gap-5 border-b border-neutral-200 pb-6 dark:border-neutral-800 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone="blue">/dev/lilith/*</Badge>
              <Badge tone="amber">设计实验室</Badge>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">不作为生产迁移蓝图</span>
            </div>
            <h1 className="text-2xl font-semibold text-neutral-950 dark:text-neutral-50 sm:text-3xl">全站 UIUX 风格切片库</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              这里用于审查 Lumine 式克制视觉如何落到 Phigros Query 的不同页面类型。它提供视觉语气、密度和组件关系参考，但生产改造必须重新判断信息架构，尤其是仪表盘。
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="flex gap-3">
              <ShieldAlert className="mt-1 size-4 shrink-0" aria-hidden="true" />
              <p>Dashboard、排行榜、开放平台这类复杂工具台只能参考 token 与密度，不能复制普通生成器切片的布局。</p>
            </div>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Panel className="lg:col-span-1">
            <div className="flex items-center gap-3 p-4">
              <span className="flex size-10 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300">
                <Sparkles className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">覆盖页面</p>
                <p className="text-2xl font-semibold text-neutral-950 dark:text-neutral-50">{lilithSlices.length}</p>
              </div>
            </div>
          </Panel>
          <Panel className="lg:col-span-1">
            <div className="flex items-center gap-3 p-4">
              <span className="flex size-10 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                <Route className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">页面类型</p>
                <p className="text-2xl font-semibold text-neutral-950 dark:text-neutral-50">{typeCounts.length}</p>
              </div>
            </div>
          </Panel>
          <Panel className="sm:col-span-2">
            <div className="grid gap-2 p-4 sm:grid-cols-3">
              <TypeStat type="workspace" count={lilithSlices.filter((slice) => slice.type === 'workspace').length} />
              <TypeStat type="console" count={lilithSlices.filter((slice) => slice.type === 'console').length} />
              <TypeStat type="document" count={lilithSlices.filter((slice) => slice.type === 'document').length} />
            </div>
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="可以借鉴" description="这些是风格层、组件关系和状态表达，可以进入后续生产改造规范。">
            <div className="p-4">
              <RuleList items={borrowRules} tone="good" />
            </div>
          </Panel>
          <Panel title="不能直接迁移" description="这些是生产改造前必须守住的边界，避免把切片变成套壳。">
            <div className="p-4">
              <RuleList items={blockedRules} tone="bad" />
            </div>
          </Panel>
        </div>

        <Panel
          title="切片覆盖矩阵"
          description="每张卡片进入一个独立页面类型切片；桌面端不靠空白撑开，移动端按任务流自然堆叠。"
        >
          <div className="space-y-6 p-4">
            {groupedSlices.map(({ type, slices }) => (
              <section key={type} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge tone={type === 'workspace' ? 'amber' : type === 'generator' ? 'blue' : 'neutral'}>{sliceTypeLabels[type]}</Badge>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">{slices.length} 个切片</span>
                  </div>
                  {type === 'workspace' && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                      <LayoutDashboard className="size-3.5" aria-hidden="true" />
                      先重画信息架构
                    </span>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {slices.map((slice) => (
                    <SliceCard key={slice.slug} slice={slice} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Panel>

        <Panel title="迁移边界与后续判断" description="审查切片时先看页面类型，再决定生产页面是否需要结构重画。">
          <div className="grid gap-0 md:grid-cols-3">
            <div className="border-b border-neutral-100 p-4 dark:border-neutral-800 md:border-b-0 md:border-r">
              <Palette className="mb-3 size-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">先看视觉语气</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">确认颜色、边框、字号、按钮和状态是否符合全站规范。</p>
            </div>
            <div className="border-b border-neutral-100 p-4 dark:border-neutral-800 md:border-b-0 md:border-r">
              <Route className="mb-3 size-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">再看任务流</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">检查当前页面的核心任务、状态、恢复路径和移动端顺序。</p>
            </div>
            <div className="p-4">
              <ShieldAlert className="mb-3 size-5 text-amber-600 dark:text-amber-300" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">最后才迁移样式</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">生产页只迁移被验证过的组件关系，不迁移未经审查的布局假设。</p>
            </div>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}
