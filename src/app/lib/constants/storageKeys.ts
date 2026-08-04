/**
 * localStorage key 常量集中管理
 *
 * 说明：
 * - key 一旦变化会影响“跨页面/跨版本”的状态读取，请统一从此处引用，避免漏改。
 */

// 用户是否已在站内确认并接受协议（agreement）
export const AGREEMENT_ACCEPTED_KEY = 'phigros_agreement_accepted';

// 最近一次成功登录的本地缓存标记（仅 UI 提示用途，不作为鉴权依据）
export const LOGIN_CACHED_KEY = 'phigros_login_cached';

// 被封禁页展示文案（会话级）
export const BANNED_DETAIL_KEY = 'phigros_banned_detail';
