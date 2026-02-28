import React from 'react';
import { PageShell } from '../../components/PageShell';
import { SiteHeader } from '../../components/SiteHeader';
import { BestnSvgDemoClient } from './components/BestnSvgDemoClient';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const raw = resolvedSearchParams?.debug;
  const debug =
    raw === '1' ||
    raw === 'true' ||
    (Array.isArray(raw) && (raw.includes('1') || raw.includes('true')));

  return (
    <PageShell
      variant="plain"
      header={<SiteHeader />}
      footerVariant="none"
      mainClassName="px-4 py-6 sm:px-6 sm:py-8"
      containerClassName="w-full max-w-5xl mx-auto space-y-4"
    >
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            BestN SVG 渲染测试
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            本页面复用 BestN 生成组件，并在请求中通过查询参数添加{' '}
            <code className="font-mono">format=svg</code> 获取 SVG 输出，用于验证前端能否正常渲染后端返回的 SVG 图片。
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            提示：该功能需要登录凭证；若未登录请先前往登录页。
          </p>
        </header>

        <BestnSvgDemoClient debugExport={debug} />
    </PageShell>
  );
}
