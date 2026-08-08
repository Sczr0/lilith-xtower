import Link from 'next/link';
import { PageShell } from '../components/PageShell';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { buttonStyles } from '../components/ui/styles';
import { AgreementContent } from '../agreement/components/AgreementContent';
import { getPrecompiledAssetServer } from '../lib/precompiled-server';
import type { PrecompiledSignatureInfo } from '../lib/precompiled-types';

/**
 * 隐私协议页面 - SSG 静态生成
 * 在构建时获取预编译内容，提升首屏加载性能和 SEO
 */
export default async function PrivacyPage() {
  let htmlContent = '';
  let tocItems: { id: string; title: string; level: number }[] = [];
  let signatureInfo: PrecompiledSignatureInfo | undefined = undefined;
  let error: string | null = null;

  try {
    const { html, toc, signature } = await getPrecompiledAssetServer('privacy');
    htmlContent = html;
    tocItems = Array.isArray(toc) ? toc : [];
    signatureInfo = signature;
  } catch (err) {
    console.error('Failed to load privacy policy:', err);
    error = '隐私协议暂时无法加载，请稍后重试。';
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
              <Link href="/privacy" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                刷新页面
              </Link>
              <Link href="/contribute" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                反馈问题
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mx-auto max-w-7xl px-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-gray-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-gray-200">
              <p className="font-medium">诊断信息说明</p>
              <p className="mt-1">
                为帮助定位问题，当您通过「遇到问题？」反馈问题或页面出错时，站点可能自动附带诊断信息（页面、
                构建版本、浏览器/系统、登录状态、最近操作与错误摘要）。诊断信息不含登录凭证等敏感内容，
                您可在反馈弹窗中查看并复制完整内容。
              </p>
            </div>
          </div>
          <AgreementContent
            htmlContent={htmlContent}
            tocItems={tocItems}
            title="隐私协议"
            subtitle="请在使用服务前仔细阅读以下隐私条款。"
            signatureInfo={signatureInfo}
          />
        </>
      )}
    </PageShell>
  );
}
