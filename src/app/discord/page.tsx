import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PageShell } from '../components/PageShell';
import { SiteHeader } from '../components/SiteHeader';
import { buttonStyles, cardStyles } from '../components/ui/styles';
import { getDiscordInviteRedirectHref } from '../config/discord.config';

export const metadata: Metadata = {
  title: 'Discord 邀请链接',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function DiscordRedirectPage() {
  const redirectHref = getDiscordInviteRedirectHref();

  if (redirectHref) {
    redirect(redirectHref);
  }

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
          Discord 邀请入口暂未配置
        </h1>
        <div className="mt-3 space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            当前站点尚未配置 Discord 邀请链接，因此无法继续跳转。
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            如果你是站点维护者，请在部署环境中设置 <code>DISCORD_INVITE_URL</code> 或{' '}
            <code>NEXT_PUBLIC_DISCORD_INVITE_URL</code>，然后重新访问此路径。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/" className={buttonStyles({ variant: 'primary' })}>
              返回首页
            </Link>
            <Link href="/about" className={buttonStyles({ variant: 'outline' })}>
              前往关于页
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
