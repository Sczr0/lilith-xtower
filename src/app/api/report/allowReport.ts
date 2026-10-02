import { slidingWindowAllow } from '@/app/lib/api/rateLimit';

/**
 * 上报端点的 IP 限流。
 *
 * 说明：放在独立模块而不是 route.ts 里 —— Next 16 会为路由文件生成类型，
 * 校验「路由模块只导出允许的名字」（GET/POST/config/dynamic…）。把 `allowReport`
 * 从 route.ts 导出会让 `next build --webpack` 的类型检查直接失败：
 *   .next/types/app/api/report/route.ts: error TS2344: Property 'allowReport'
 *   is incompatible with index signature.
 * 该函数只是给测试用，无需成为路由模块的导出。
 */

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

/** 基于 IP 的滑动窗口限流（共享实现，含过期桶自动清理；单实例有效） */
export function allowReport(key: string): boolean {
  return slidingWindowAllow(`report:${key}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
}
