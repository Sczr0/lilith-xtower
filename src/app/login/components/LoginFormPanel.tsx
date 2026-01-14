'use client';

import dynamic from 'next/dynamic';
import type { AuthMethod, TapTapVersion } from '../../lib/types/auth';

function LoginMethodLoading(props: { error?: Error | null; isLoading?: boolean; pastDelay?: boolean }) {
  // 说明：dynamic 的 loading 会注入状态参数；这里不需要使用，但要避免 eslint unused-vars。
  void props;
  return (
    <div className="flex items-center justify-center py-10">
      <span className="text-sm text-gray-600 dark:text-gray-400">正在加载…</span>
    </div>
  );
}

const QRCodeLogin = dynamic<{ taptapVersion: TapTapVersion }>(
  () => import('./QRCodeLogin').then((m) => m.QRCodeLogin),
  { ssr: false, loading: LoginMethodLoading }
);

const ManualLogin = dynamic(
  () => import('./ManualLogin').then((m) => m.ManualLogin),
  { ssr: false, loading: LoginMethodLoading }
);

const APILogin = dynamic(
  () => import('./APILogin').then((m) => m.APILogin),
  { ssr: false, loading: LoginMethodLoading }
);

const PlatformLogin = dynamic(
  () => import('./PlatformLogin').then((m) => m.PlatformLogin),
  { ssr: false, loading: LoginMethodLoading }
);

export function LoginFormPanel({
  activeMethod,
  taptapVersion,
}: {
  activeMethod: AuthMethod;
  taptapVersion: TapTapVersion;
}) {
  switch (activeMethod) {
    case 'qrcode':
      return <QRCodeLogin key={taptapVersion} taptapVersion={taptapVersion} />;
    case 'manual':
      return <ManualLogin />;
    case 'api':
      return <APILogin />;
    case 'platform':
      return <PlatformLogin />;
    default:
      return null;
  }
}

