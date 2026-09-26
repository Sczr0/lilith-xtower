import { LoadingPlaceholder } from '../components/LoadingIndicator';
import { PageShell } from '../components/PageShell';
import { SiteHeader } from '../components/SiteHeader';

/**
 * /sponsors 的加载骨架。
 *
 * 该页在服务端 await 爱发电赞助者数据（ISR 10 分钟），保留标题与引导文案，
 * 使软导航时页面结构不跳动。
 */
export default function SponsorsLoading() {
  return (
    <PageShell variant="plain" header={<SiteHeader />} footerVariant="none">
      <div className="space-y-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">赞助者名单</h1>
        <LoadingPlaceholder text="正在加载赞助者名单..." />
      </div>
    </PageShell>
  );
}
