import { LoadingPlaceholder } from '../components/LoadingIndicator';
import { PageShell } from '../components/PageShell';
import { SiteHeader } from '../components/SiteHeader';

/**
 * /qa 的加载骨架。与 /songs、/sponsors 保持一致的导航反馈。
 */
export default function QaLoading() {
  return (
    <PageShell
      variant="gradient"
      header={<SiteHeader />}
      mainClassName="relative z-10 flex-1 p-4 sm:p-6 lg:p-8"
      containerClassName="max-w-4xl mx-auto"
    >
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          常见问题
        </h1>
      </div>
      <LoadingPlaceholder text="正在加载常见问题..." />
    </PageShell>
  );
}
