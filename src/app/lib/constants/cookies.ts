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

