import { SiteHeader } from '../components/SiteHeader';
import { PageShell } from '../components/PageShell';
import { getSongInfoData } from '@/app/lib/info/songInfo';
import { InfoPage } from './components/InfoPage';

/**
 * 曲目信息页（/songs）
 * 服务端预取曲目信息（含内存缓存），失败时把错误传给客户端展示降级 UI。
 * 数据来自外部源（somnia.xtower.site），使用动态渲染避免预渲染导致数据过期。
 */
export const dynamic = 'force-dynamic';

export default async function InfoPageServer() {
  let initialData = null;
  let initialError: string | null = null;

  try {
    initialData = await getSongInfoData();
  } catch (error) {
    initialError = error instanceof Error ? error.message : '未知错误';
  }

  return (
    <PageShell
      variant="gradient"
      header={<SiteHeader />}
      footerVariant="rights"
      mainClassName="relative z-10 flex-1 p-4 sm:p-6 lg:p-8"
      containerClassName="max-w-7xl mx-auto space-y-6"
    >
      <InfoPage initialData={initialData} initialError={initialError} />
    </PageShell>
  );
}
