/**
 * 客户端鉴权守卫决策（纯函数，便于单测）。
 *
 * 背景（P0-2）：/api/session 抽风时（超时/网络错误/上游 5xx），前端只能知道
 * 「暂时查不到会话状态」，这**不等于**「未登录」。旧实现把两者混为一谈，
 * 导致守卫把用户踢去 /login，而 /login 又因本地登录缓存弹回 /dashboard，
 * 表现为「先闪一下登录页再被跳回仪表盘」。
 *
 * 约定：
 * - isLoading：状态尚未就绪 → 保持等待（渲染加载态）。
 * - isSessionVerified=false：状态查不到（瞬时失败）→ 不跳转，留在原页等业务接口 401 兜底。
 * - isSessionVerified=true 且未登录：权威判定 → 跳转登录页。
 */
export type AuthGuardAction = 'wait' | 'redirect-login' | 'allow';

export function resolveAuthGuardAction(input: {
  isLoading: boolean;
  isAuthenticated: boolean;
  isSessionVerified: boolean;
}): AuthGuardAction {
  if (input.isLoading) return 'wait';
  if (input.isAuthenticated) return 'allow';
  if (!input.isSessionVerified) return 'wait';
  return 'redirect-login';
}
