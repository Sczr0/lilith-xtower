import { AuthInspectorPage } from '../components/AuthInspectorPage';
import { notFound } from 'next/navigation';

type SearchParams = Record<string, string | string[] | undefined>;

function readKey(searchParams: SearchParams): string {
  const value = searchParams.key;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? '';
  return '';
}

export default function DebugAuthPage({ searchParams }: { searchParams: SearchParams }) {
  // 生产环境开启 debug-auth 时，必须额外提供访问门槛，避免误开启后被外部直接访问。
  // - DEBUG_AUTH_ENABLED=1：允许路由存在（layout 级别控制）
  // - DEBUG_AUTH_ACCESS_KEY：二次校验（page 级别控制）
  if (process.env.NODE_ENV === 'production' && process.env.DEBUG_AUTH_ENABLED === '1') {
    const requiredKey = process.env.DEBUG_AUTH_ACCESS_KEY?.trim();
    if (!requiredKey) notFound();
    if (readKey(searchParams) !== requiredKey) notFound();
  }

  return <AuthInspectorPage mode="debug" />;
}
