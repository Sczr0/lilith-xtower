import { AuthInspectorPage } from '../components/AuthInspectorPage';
import { PageShell } from '../components/PageShell';

export default function AuthPage() {
  return (
    <PageShell variant="gradient" main={false} footerVariant="none">
      <AuthInspectorPage mode="safe" />
    </PageShell>
  );
}
