import { LoadingPlaceholder } from '../components/LoadingIndicator';
import { PageShell } from '../components/PageShell';
import { SiteHeader } from '../components/SiteHeader';

/**
 * /about 的加载骨架。与 /songs、/sponsors、/qa 保持一致的导航反馈。
 */
export default function AboutLoading() {
  return (
    <PageShell variant="plain" header={<SiteHeader />}>
      <LoadingPlaceholder text="正在加载关于页面..." />
    </PageShell>
  );
}
