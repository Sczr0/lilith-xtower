import { NextRequest } from 'next/server';
import { Logger } from 'next-axiom';

export const runtime = 'nodejs';

/**
 * 前端错误自动上报端点（诊断信息采集的“自动路径”）。
 * 仅静默写入 Axiom（log.info('client-error')），不推送飞书；
 * 飞书告警留作后续（P2）在日志侧聚合后触发。
 */

const ALLOWED_KINDS = new Set(['error', 'unhandledrejection']);
const MAX_EVENTS = 50;
const MAX_STR = 1000;
const MAX_STACK = 8000;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

/** 基于 IP 的滑动窗口限流（单实例有效；多实例部署需替换为 Redis/KV） */
const rateLimiter = new Map<string, number[]>();

export function allowReport(key: string): boolean {
  const now = Date.now();
  const bucket = rateLimiter.get(key) ?? [];
  const next = bucket.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (next.length >= RATE_LIMIT_MAX) {
    rateLimiter.set(key, next);
    return false;
  }
  next.push(now);
  rateLimiter.set(key, next);
  return true;
}

function resolveClientIp(req: NextRequest): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real;
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  return 'unknown';
}

export async function POST(req: NextRequest) {
  const log = new Logger();

  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return new Response('Bad Request', { status: 400 });
    }
    const raw = await req.json();

    // 字段校验与瘦身（镜像 rum 路由的清洗风格，所有字段逐项截断）
    const cleaned = (() => {
      const d = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
      const kind = typeof d.kind === 'string' ? d.kind : undefined;
      const message = typeof d.message === 'string' ? d.message.slice(0, MAX_STR) : undefined;
      const stack = typeof d.stack === 'string' ? d.stack.slice(0, MAX_STACK) : undefined;
      const page = typeof d.page === 'string' ? d.page.slice(0, 1024) : undefined;
      const version = typeof d.version === 'string' ? d.version.slice(0, 64) : undefined;
      const viewId = typeof d.viewId === 'string' ? d.viewId.slice(0, 64) : undefined;
      const t = typeof d.t === 'number' ? d.t : Date.now();
      const online = typeof d.online === 'boolean' ? d.online : undefined;
      const networkType =
        typeof d.networkType === 'string' ? d.networkType.slice(0, 32) : undefined;
      const login = (() => {
        const l = d.login;
        if (!l || typeof l !== 'object') return undefined;
        const loginRaw = l as Record<string, unknown>;
        return {
          authenticated:
            typeof loginRaw.authenticated === 'boolean' ? loginRaw.authenticated : undefined,
          method: typeof loginRaw.method === 'string' ? loginRaw.method.slice(0, 32) : undefined,
        };
      })();
      const events = Array.isArray(d.events)
        ? d.events.slice(-MAX_EVENTS).map((e) => {
            const ev = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
            const out: Record<string, unknown> = {};
            if (typeof ev.t === 'number') out.t = ev.t;
            if (ev.type === 'fetch' || ev.type === 'route' || ev.type === 'error') {
              out.type = ev.type;
            }
            if (typeof ev.url === 'string') out.url = ev.url.slice(0, 512);
            if (typeof ev.method === 'string') out.method = ev.method.slice(0, 16);
            if (typeof ev.status === 'number') out.status = ev.status;
            if (typeof ev.durMs === 'number') out.durMs = ev.durMs;
            if (typeof ev.message === 'string') out.message = ev.message.slice(0, MAX_STR);
            if (typeof ev.stack === 'string') out.stack = ev.stack.slice(0, 4000);
            return out;
          })
        : [];
      return { kind, message, stack, page, version, viewId, t, online, networkType, login, events };
    })();

    // 丢弃非法数据（先校验再限流，避免刷无效请求挤占配额）
    if (!cleaned.kind || !ALLOWED_KINDS.has(cleaned.kind)) {
      return new Response(null, { status: 204 });
    }
    if (!cleaned.message && cleaned.events.length === 0) {
      return new Response(null, { status: 204 });
    }

    const ip = resolveClientIp(req);
    if (!allowReport(ip)) {
      return new Response(null, { status: 204 });
    }

    // 上报到 Axiom（失败不影响响应）
    try {
      const ua = req.headers.get('user-agent') || '';
      log.info('client-error', { ...cleaned, ua });
      // 必须 flush 才能确保数据发出
      await log.flush();
    } catch (e) {
      console.error('Axiom logging error:', e);
    }
  } catch {}
  // 无正文 204，便于 sendBeacon 快速返回
  return new Response(null, { status: 204 });
}
