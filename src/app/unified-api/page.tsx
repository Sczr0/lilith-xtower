import { redirect } from 'next/navigation';

export default function UnifiedApiRedirectPage() {
  // 说明：/unified-api 作为历史入口保留，用于跳转到新的“联合API仪表盘”。
  redirect('/unified-api-dashboard');
}

