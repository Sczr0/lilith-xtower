import Link from 'next/link';
import { PageShell } from '../components/PageShell';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { buttonStyles } from '../components/ui/styles';
import { AgreementContent } from './components/AgreementContent';
import { getPrecompiledAssetServer } from '../lib/precompiled-server';
import type { PrecompiledSignatureInfo } from '../lib/precompiled-types';

/**
 * 用户协议页面 - SSG 静态生成
 * 在构建时获取预编译内容，提升首屏加载性能和 SEO
 */
export default async function AgreementPage() {
  let htmlContent = '';
  let tocItems: { id: string; title: string; level: number }[] = [];
  let signatureInfo: PrecompiledSignatureInfo | undefined = undefined;
  let error: string | null = null;

  try {
    const { html, toc, signature } = await getPrecompiledAssetServer('agreement');
    htmlContent = html;
    tocItems = Array.isArray(toc) ? toc : [];
    signatureInfo = signature;
  } catch (err) {
    console.error('Failed to load agreement:', err);
    error = '用户协议暂时无法加载，请稍后重试。';
  }

  return (
    <PageShell
      variant="plain"
      header={<SiteHeader />}
      main={false}
      afterMain={
        <div className="px-4 pb-10 sm:pb-14">
          <div className="mx-auto max-w-7xl">
            <SiteFooter />
          </div>
        </div>
      }
    >
      {error ? (
        <div className="px-4">
          <div className="mx-auto mt-16 max-w-xl space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-6 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/" className={buttonStyles({ variant: 'primary', size: 'sm' })}>
                返回首页
              </Link>
              <Link href="/agreement" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                刷新页面
              </Link>
              <Link href="/contribute" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                反馈问题
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <AgreementContent htmlContent={htmlContent} tocItems={tocItems} signatureInfo={signatureInfo} />
      )}
    </PageShell>
  );
}
