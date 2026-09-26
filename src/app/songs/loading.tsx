import { LoadingPlaceholder } from '../components/LoadingIndicator';
import { PageShell } from '../components/PageShell';
import { SiteHeader } from '../components/SiteHeader';

/**
 * /songs 的加载骨架。
 *
 * 该页在服务端 await 上游曲目数据（ISR 1 小时），软导航首次进入时存在真实等待窗口；
 * 这里沿用服务端预渲染 + 流式 fallback，让导航立即可见反馈。
 */
export default function SongsLoading() {
  return (
    <PageShell
      variant="gradient"
      header={<SiteHeader />}
      footerVariant="rights"
      mainClassName="relative z-10 flex-1 p-4 sm:p-6 lg:p-8"
      containerClassName="max-w-7xl mx-auto space-y-6"
    >
      <LoadingPlaceholder text="正在加载曲目信息..." />
    </PageShell>
  );
}
