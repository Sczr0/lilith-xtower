import type { NextRequest } from 'next/server';

/**
 * 轻量内存限流工具（单实例有效；多实例部署需替换为 Redis/KV）。
 *
 * 设计约束：
 * - 滑动窗口：按 key 记录时间戳数组，窗口内超过 limit 则拒绝。
 * - 内存自清理：每次写入时惰性修剪当前 key 的过期时间戳；
 *   每 SWEEP_INTERVAL 次写入触发一次全量清扫，避免 Map 无限增长。
 */

const SWEEP_INTERVAL = 256;
const SWEEP_MAX_WINDOW_MS = 60 * 60 * 1000; // 清扫兜底：超过该窗口的桶视为可回收

type Bucket = { windowMs: number; timestamps: number[] };

const buckets = new Map<string, Bucket>();
let writeCount = 0;

export function slidingWindowAllow(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  const bucket = buckets.get(key);
  const timestamps = bucket?.timestamps ?? [];
  const next = timestamps.filter((ts) => now - ts < windowMs);

  if (next.length >= limit) {
    // 仍然修剪过期时间戳，避免桶无限膨胀
    if (next.length !== timestamps.length) buckets.set(key, { windowMs, timestamps: next });
    return false;
  }

  next.push(now);
  buckets.set(key, { windowMs, timestamps: next });

  writeCount += 1;
  if (writeCount >= SWEEP_INTERVAL) {
    writeCount = 0;
    sweepExpired(now);
  }
  return true;
}

/** 全量清扫：删除窗口内已无任何记录的桶（惰性触发，成本 O(桶数)）。 */
function sweepExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    const last = bucket.timestamps[bucket.timestamps.length - 1];
    if (last === undefined) {
      buckets.delete(key);
      continue;
    }
    const effectiveWindow = Math.min(bucket.windowMs, SWEEP_MAX_WINDOW_MS);
    if (now - last >= effectiveWindow) {
      buckets.delete(key);
    }
  }
}

/**
 * 解析客户端 IP：仅信任平台侧写入的头（Cloudflare / 反向代理）。
 * 注意：若部署环境不提供这些头，返回 'unknown'（限流退化为全局桶）。
 */
export function resolveClientIp(req: NextRequest): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real;
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  return 'unknown';
}
