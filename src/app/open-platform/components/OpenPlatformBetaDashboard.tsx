'use client';

import type { ComponentType } from 'react';
import { useMemo, useState } from 'react';
import {
  BarChart3,
  CircleHelp,
  CreditCard,
  ExternalLink,
  FileText,
  KeyRound,
  Layers,
  Mail,
  UserRound,
} from 'lucide-react';
import { buttonStyles, cardStyles, cx } from '../../components/ui/styles';
import { buildGoHref } from '../../utils/outbound';
import { OpenPlatformAuthPanel } from './OpenPlatformAuthPanel';
import { OpenPlatformApiKeysPanel } from './OpenPlatformApiKeysPanel';

type DashboardSectionId = 'usage' | 'keys' | 'billing' | 'account';

type DashboardNavItem = {
  id: DashboardSectionId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
};

const DOCS_URL = 'https://seekend.xtower.site/docs/';

const PRIMARY_ITEMS: DashboardNavItem[] = [
  {
    id: 'usage',
    label: '用量信息',
    icon: BarChart3,
    description: '请求趋势与概览',
  },
  {
    id: 'keys',
    label: 'API keys',
    icon: KeyRound,
    description: '创建与管理密钥',
  },
  {
    id: 'billing',
    label: '账单与配额',
    icon: CreditCard,
    description: 'Beta 阶段占位',
  },
  {
    id: 'account',
    label: '开发者账户',
    icon: UserRound,
    description: 'GitHub 登录状态',
  },
];

function NavButton({
  item,
  active,
  onClick,
}: {
  item: DashboardNavItem;
  active: boolean;
  onClick: (id: DashboardSectionId) => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => onClick(item.id)}
      className={cx(
        'w-full rounded-xl px-3 py-2.5 text-left transition-colors border',
        active
          ? 'bg-white text-gray-900 border-gray-300 shadow-sm dark:bg-neutral-800 dark:text-gray-100 dark:border-neutral-700'
          : 'bg-transparent border-transparent text-gray-600 hover:text-gray-900 hover:bg-white/70 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-neutral-800/60',
      )}
    >
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="text-sm font-medium">{item.label}</span>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
    </button>
  );
}

function UsagePlaceholder() {
  return (
    <section className={cardStyles({ padding: 'md' })}>
      <h2 className="text-2xl font-semibold tracking-tight">用量信息</h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Beta 阶段先开放 API Key 管理。调用量、错误率、接口分布等统计将随服务端聚合接口一并上线。
      </p>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400">近 24 小时请求</div>
          <div className="mt-1 text-2xl font-semibold">--</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400">错误率</div>
          <div className="mt-1 text-2xl font-semibold">--</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400">活跃 API Keys</div>
          <div className="mt-1 text-2xl font-semibold">--</div>
        </div>
      </div>
    </section>
  );
}

function BillingPlaceholder() {
  return (
    <section className={cardStyles({ padding: 'md' })}>
      <h2 className="text-2xl font-semibold tracking-tight">账单与配额</h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        当前为 Beta 灰度阶段，暂未启用计费。后续将提供每个 Key 的调用配额与套餐策略。
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a href={buildGoHref(DOCS_URL) ?? DOCS_URL} target="_blank" rel="noreferrer" className={buttonStyles({ size: 'sm', variant: 'outline' })}>
          <FileText className="h-4 w-4" aria-hidden="true" />
          查看接口文档
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

export function OpenPlatformBetaDashboard() {
  const [activeSection, setActiveSection] = useState<DashboardSectionId>('keys');

  const content = useMemo(() => {
    if (activeSection === 'usage') return <UsagePlaceholder />;
    if (activeSection === 'billing') return <BillingPlaceholder />;
    if (activeSection === 'account') return <OpenPlatformAuthPanel />;
    return <OpenPlatformApiKeysPanel />;
  }, [activeSection]);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-gray-100 dark:bg-neutral-950 shadow-sm overflow-hidden">
      <div className="bg-blue-600 text-white text-xs px-4 py-2 flex items-center justify-between gap-3">
        <span className="truncate">开发者仪表盘 Beta 已开启：当前优先开放 API keys 管理能力。</span>
        <Layers className="h-4 w-4 shrink-0" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/40 p-4 lg:p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-gray-900 text-white dark:bg-white dark:text-gray-900 flex items-center justify-center text-sm font-bold">
              PQ
            </div>
            <div>
              <div className="text-sm font-semibold">Phigros Query</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">开发平台</div>
            </div>
          </div>

          <nav className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {PRIMARY_ITEMS.map((item) => (
              <div key={item.id} className="min-w-[180px] lg:min-w-0">
                <NavButton item={item} active={activeSection === item.id} onClick={setActiveSection} />
              </div>
            ))}
          </nav>

          <div className="mt-5 pt-4 border-t border-gray-200 dark:border-neutral-800 space-y-2">
            <a
              href={buildGoHref(DOCS_URL) ?? DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              接口文档
            </a>
            <a
              href="/qa"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            >
              <CircleHelp className="h-4 w-4" aria-hidden="true" />
              常见问题
            </a>
            <a
              href="/about"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              联系维护者
            </a>
          </div>
        </aside>

        <main className="p-4 sm:p-6 lg:p-8 bg-gray-100 dark:bg-neutral-950/60">{content}</main>
      </div>
    </div>
  );
}
