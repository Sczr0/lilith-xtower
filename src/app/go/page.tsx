import type { Metadata } from 'next'
import Link from 'next/link'

import { PageShell } from '../components/PageShell'
import { SiteHeader } from '../components/SiteHeader'
import { buttonStyles, cardStyles } from '../components/ui/styles'
import { parseGoUrlParam } from '../utils/outbound'
import { SITE_URL } from '../utils/site-url'

export const metadata: Metadata = {
  title: '站外跳转提示',
  // 说明：中间页不应被搜索引擎收录，避免把带参数的跳转页当成内容页面。
  robots: { index: false, follow: false },
  // 说明：默认不发送 Referer（用户可控的站外跳转场景更安全、也更符合“提示页”定位）。
  referrer: 'no-referrer',
}

type GoPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

export default function GoPage({ searchParams }: GoPageProps) {
  const rawUrlParam =
    searchParams?.url ?? searchParams?.u ?? searchParams?.to ?? searchParams?.target ?? searchParams?.redirect
  const parsed = parseGoUrlParam(rawUrlParam)

  let siteOrigin = SITE_URL
  try {
    siteOrigin = new URL(SITE_URL).origin
  } catch {}

  const isLeavingSite = parsed.ok ? parsed.url.origin !== siteOrigin : false

  return (
    <PageShell
      variant="gradient"
      header={<SiteHeader />}
      footerVariant="links"
      mainClassName="relative z-10 flex-1 p-4 sm:p-6 lg:p-8"
      containerClassName="max-w-2xl mx-auto space-y-6"
    >
      <section className={cardStyles({ tone: 'glass', padding: 'md' })}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
          {isLeavingSite ? '即将离开本站' : '链接提示'}
        </h1>

        {!parsed.ok ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              未提供有效的跳转地址，或地址格式不正确。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/" className={buttonStyles({ variant: 'primary' })}>
                返回首页
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {isLeavingSite
                ? '你将前往以下地址，请确认链接安全后继续：'
                : '该链接指向本站资源：'}
            </p>

            <div className="rounded-xl border border-gray-200/70 dark:border-neutral-800/70 bg-white/70 dark:bg-neutral-950/40 px-4 py-3">
              <div className="text-xs text-gray-500 dark:text-gray-400">目标 URL</div>
              <div className="mt-1 break-all font-mono text-sm text-gray-900 dark:text-gray-50">
                {parsed.normalized}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href={parsed.normalized}
                className={buttonStyles({ variant: 'primary' })}
                // 说明：继续访问在“当前新标签页”内完成导航，避免额外弹出第二个标签页。
                target="_self"
                rel="noreferrer noopener"
                referrerPolicy="no-referrer"
              >
                继续访问
              </a>
              <Link href="/" className={buttonStyles({ variant: 'outline' })}>
                返回首页
              </Link>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              提示：如果该跳转不是你主动触发的，请关闭此页。
            </p>
          </div>
        )}
      </section>
    </PageShell>
  )
}
