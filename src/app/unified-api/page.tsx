import { redirect } from 'next/navigation';

export default function UnifiedApiRedirectPage() {
  // 说明：/unified-api 作为历史入口保留，用于跳转到新的“联合API仪表盘”。
  // PageShell 覆盖策略：该路由无可视内容，仅做服务端重定向，不渲染页面骨架。
  redirect('/unified-api-dashboard');
}
