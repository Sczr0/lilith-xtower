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
 * 判断 IP 是否为可公网路由地址（用于从 XFF 中跳过私有/回环跳数）。
 * 覆盖常见 v4 私有段与 v6 回环/ULA/link-local；解析不了的格式按不可路由处理。
 */
export function isPubliclyRoutableIp(ip: string): boolean {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (v4) {
    const octets = v4.slice(1).map(Number);
    if (octets.some((n) => n > 255)) return false;
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127) return false; // 本机/内网/回环
    if (a === 169 && b === 254) return false; // link-local
    if (a === 172 && b >= 16 && b <= 31) return false; // 内网
    if (a === 192 && b === 168) return false; // 内网
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
    return true;
  }

  const lower = ip.toLowerCase();
  if (!lower.includes(':')) return false; // 非 v4 且无冒号 → 无法解析，按不可路由处理
  if (lower === '::' || lower === '::1') return false;
  if (lower.startsWith('::ffff:')) return isPubliclyRoutableIp(lower.slice('::ffff:'.length)); // v4-mapped
  if (lower.startsWith('fc') || lower.startsWith('fd')) return false; // ULA fc00::/7
  if (/^fe[89ab]/.test(lower)) return false; // link-local fe80::/10
  return true;
}

/**
 * 解析客户端 IP：仅作为限流等安全控制的 key 使用。
 *
 * 信任模型（部署平台：阿里云 ESA）：
 * - 推荐姿势：在 ESA 控制台「规则 → 转换规则 → 托管转换」开启「回源自动注入
 *   客户端真实 IP」，并设置 TRUSTED_CLIENT_IP_HEADER=ali-real-client-ip。
 *   该头由 ESA 边缘节点写入「建立 TCP 连接的客户端真实 IP」，不受客户端伪造
 *   影响，是最可信来源；配置后只信任该单一头、不再回退 XFF。
 * - 未配置时的兜底：解析 X-Forwarded-For，取「从尾向前第一个可公网路由的 IP」。
 *   XFF 链路中客户端自带的前缀可被任意伪造（首跳绝不可信）；取尾部对 CDN
 *   「覆盖」与「追加」两种回源语义均成立（覆盖时仅剩真实 IP 单值；追加时
 *   真实 IP 位于客户端自带前缀之后）。从尾跳过私有/回环地址可兼容边缘内部
 *   多跳追加内网 IP 的情况。
 * - 前提：源站应仅接受来自 ESA 回源网段的请求（ESA「源站防护」/防火墙白名单）。
 *   若源站端口可被直连，攻击者仍可伪造整个 XFF —— 属于部署层必须收口的面。
 * - 拿不到可信 IP 时返回 'unknown'：限流退化为全局共享桶（宁可全站共享限额，
 *   不可放任伪造头绕过）。
 */
export function resolveClientIp(req: NextRequest): string {
  const trustedHeader = (process.env.TRUSTED_CLIENT_IP_HEADER ?? '').trim();
  if (trustedHeader) {
    return req.headers.get(trustedHeader)?.trim() || 'unknown';
  }

  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const hops = xff
      .split(',')
      .map((hop) => hop.trim())
      .filter(Boolean);
    for (let index = hops.length - 1; index >= 0; index -= 1) {
      if (isPubliclyRoutableIp(hops[index])) return hops[index];
    }
    // 全部为私有/非法地址时退回最后一跳，保证仍有稳定的限流 key（如本机调试）
    return hops[hops.length - 1] ?? 'unknown';
  }

  return 'unknown';
}
