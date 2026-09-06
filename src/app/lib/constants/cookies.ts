/**
 * Cookie 常量集中管理
 *
 * 说明：
 * - 该文件必须保持“纯常量”，避免引入 Node-only / Edge-only 依赖，
 *   以便同时被 middleware（Edge Runtime）与服务端模块复用。
 */

// 登录会话 cookie（iron-session）
export const AUTH_SESSION_COOKIE_NAME = 'phigros_auth_session';

// /debug-auth 调试入口短时放行 cookie
export const DEBUG_AUTH_COOKIE_NAME = 'phigros_debug_auth';

/**
 * 站内自有 Cookie 名单。
 * - catch-all 代理转发上游前剔除这些 Cookie（不把本站会话状态外发给上游）；
 * - 上游 Set-Cookie 与这些名字冲突时一律丢弃（防止上游覆盖/伪造站内会话状态）。
 * 新增站内 Cookie 时必须同步登记到此名单。
 */
export const SITE_OWNED_COOKIE_NAMES: ReadonlySet<string> = new Set([
  AUTH_SESSION_COOKIE_NAME,
  DEBUG_AUTH_COOKIE_NAME,
]);

