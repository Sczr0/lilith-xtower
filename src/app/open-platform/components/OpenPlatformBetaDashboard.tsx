'use client';

import type { ComponentType } from 'react';
import { useMemo, useState } from 'react';
import {
  BarChart3,
  CircleHelp,
  FileText,
  KeyRound,
  Layers,
  Mail,
  ScrollText,
  UserRound,
} from 'lucide-react';
import { cardStyles, cx } from '../../components/ui/styles';
import { OpenPlatformAuthPanel } from './OpenPlatformAuthPanel';
import { OpenPlatformApiKeysPanel } from './OpenPlatformApiKeysPanel';

type DashboardSectionId = 'usage' | 'keys' | 'account';

type DashboardNavItem = {
  id: DashboardSectionId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
};

const DOCS_URL = 'https://lilith.xtower.site/api-docs/';

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
        'w-full rounded-xl px-3 py-2.5 text-left transition-colors',
        active
          ? 'bg-gray-100 text-gray-900 dark:bg-neutral-800 dark:text-gray-100 font-medium'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-neutral-800/50',
      )}
    >
      <div className="flex items-center gap-2.5">
        <Icon className={cx('h-4 w-4 shrink-0', active ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400')} aria-hidden="true" />
        <span className="text-sm">{item.label}</span>
      </div>
      {/* 描述信息在侧边栏模式下可能太占空间，可以视情况保留或移除，这里暂时保留但调淡 */}
      {/* <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 pl-6.5">{item.description}</p> */}
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
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">-</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400">平均响应耗时</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">-</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400">错误率</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">-</div>
        </div>
      </div>
    </section>
  );
}

export function OpenPlatformBetaDashboard() {
  const [activeSection, setActiveSection] = useState<DashboardSectionId>('keys');

  const content = useMemo(() => {
    if (activeSection === 'usage') return <UsagePlaceholder />;
    if (activeSection === 'account') return <OpenPlatformAuthPanel />;
    return <OpenPlatformApiKeysPanel />;
  }, [activeSection]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">开发者仪表盘</h1>
        <div className="rounded-lg bg-blue-50 border border-blue-100 text-blue-800 px-4 py-3 flex items-start sm:items-center gap-3 dark:bg-blue-900/20 dark:border-blue-800/30 dark:text-blue-200">
          <Layers className="h-5 w-5 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
          <span className="text-sm font-medium">
            Beta 阶段已开启：当前优先开放 API keys 管理能力。
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-8 items-start">
        <aside className="space-y-6">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {PRIMARY_ITEMS.map((item) => (
              <div key={item.id} className="min-w-[140px] lg:min-w-0">
                <NavButton item={item} active={activeSection === item.id} onClick={setActiveSection} />
              </div>
            ))}
          </nav>

          <div className="hidden lg:block pt-6 border-t border-gray-100 dark:border-neutral-800 space-y-1">
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <FileText className="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
              接口文档
            </a>
            <a
              href="/qa"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <CircleHelp className="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
              常见问题
            </a>
            <a
              href="/open-platform/agreement"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <ScrollText className="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
              开放平台协议
            </a>
            <a
              href="/about"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <Mail className="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
              联系维护者
            </a>
          </div>
        </aside>

        <main className="min-w-0">
          {content}
        </main>
      </div>
    </div>
  );
}
