/**
 * 带超时的上游 fetch 封装（undici 专用连接池，长连接保活）。
 *
 * 背景：登录、会话校验、扫码登录、爱发电、飞书 webhook 等链路此前直接裸调 fetch，
 * 上游挂起时请求会无限占用 worker（直到平台超时）。这里统一补 AbortController 超时，
 * 复用既有路由（如 api/image/bn/route.ts）中散落的同款模式。
 *
 * 跨洋保活：源站（境内单机）到 TapTap 全球（ap-sg）、seekend 等上游的往返是跨境链路，
 * 每次新建 TCP+TLS 都要多付几个 RTT，且跨境建连更容易抖动。Node 全局 fetch 用的是
 * 内置 undici 的默认 Agent（keepAliveTimeout 仅 4s），一旦轮询间隔超过 4s（slow_down
 * 会推到 8s）连接就被回收，等于每次都要重新握手。这里改用 undici 自带的 fetch + 一个
 * 连接复用参数更宽松的专用 Agent，把这层收敛在受控连接池上，不去动全局 dispatcher。
 *
 * 语义：
 * - 超时后以 AbortError 拒绝，调用方沿用既有的 /aborted|abort/i 判定返回 504/502；
 * - 调用方已有 signal 时通过 AbortSignal.any 叠加，任一 abort 即中断。
 */

import { Agent, fetch as undiciFetch } from 'undici';

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * 上游专用连接池。参数取向：让同一条跨洋连接尽可能活过整个轮询周期。
 * - keepAliveTimeout 30s：远大于轮询最大间隔（8s），两次轮询之间连接不会被回收；
 * - keepAliveMaxTimeout 120s：活跃期长命连接可持续复用，减少重复握手；
 * - connections 16：跨境链路并发有上限，避免突发时堆出大量慢速 socket；
 * - connect.timeout 10s：跨境建连偶发卡死时尽快失败，交由上层超时/重试处理。
 */
const upstreamAgent = new Agent({
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 120_000,
  connections: 16,
  connect: { timeout: 10_000 },
});

export async function upstreamFetch(
  input: string | URL,
  init: RequestInit = {},
  options: { timeoutMs?: number } = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const signal = init.signal
    ? AbortSignal.any([init.signal, controller.signal])
    : controller.signal;

  try {
    // undici 的 fetch 与全局 fetch 语义一致，但允许显式指定 dispatcher。
    // 用自带 fetch + 专用 Agent 可保证二者来自同一份 undici，连接池行为确定。
    const undiciInit = {
      ...init,
      signal,
      dispatcher: upstreamAgent,
    } as unknown as Parameters<typeof undiciFetch>[1];
    return (await undiciFetch(input, undiciInit)) as unknown as Response;
  } finally {
    clearTimeout(timer);
  }
}
