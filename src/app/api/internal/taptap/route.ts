import { randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * ⚠️ 过渡期 shim —— 兼容**旧客户端**（浏览器 / Service Worker 缓存的旧 JS）仍在用的 4 动作契约。
 *
 * 内部改用 seekend 的 2 端点流程（`/api/v1/auth/qrcode` + `/{qr_id}/status`），所以这里只做很薄的映射
 * 与一层 `flowId → qrId/sessionToken` 的进程内状态：
 * - `device_code` → 调 seekend 建码，登记 flowId → qrId；
 * - `poll_token`  → 轮询 seekend 状态；Confirmed 后把 sessionToken 记在 flowId 上并回 `{ status:'ok', token:{} }`；
 * - `profile`     → 旧客户端要求的一步，回占位资料（服务端不使用其内容）；
 * - `leancloud`   → 交出 sessionToken。
 *
 * 新客户端已改走 `/api/auth/qrcode`（见 `src/app/lib/taptap/qrLogin.ts`），不再使用本路由。
 * TODO(过渡期后删除)：等旧 JS 自然淘汰（建议 1–2 周）后删除本文件。
 */

type Action = 'device_code' | 'poll_token' | 'profile' | 'leancloud';
const VALID_ACTIONS: readonly Action[] = ['device_code', 'poll_token', 'profile', 'leancloud'];

const UPSTREAM_BASE = (process.env.UNIFIED_API_BASE_URL || 'https://seekend.xtower.site').replace(/\/+$/, '');
const AUTH_BASE = `${UPSTREAM_BASE}/api/v1/auth/qrcode`;
const FLOW_TTL_MS = 10 * 60 * 1000;
const FLOW_SWEEP_INTERVAL = 64;

type Flow = { qrId: string; version: 'cn' | 'global'; createdAt: number; sessionToken?: string; used?: boolean };

const flows = new Map<string, Flow>();
let opCount = 0;

function sweep(): void {
  const now = Date.now();
  for (const [id, flow] of flows) if (now - flow.createdAt > FLOW_TTL_MS) flows.delete(id);
}
function track(): void {
  opCount += 1;
  if (opCount >= FLOW_SWEEP_INTERVAL) {
    opCount = 0;
    sweep();
  }
}

function jsonNoStore(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

type Body = { action?: Action; version?: unknown; flowId?: string };
type UpstreamCreate = { qrId?: string; verificationUrl?: string; expiresIn?: number; interval?: number; detail?: string; message?: string };
type UpstreamStatus = { status?: string; sessionToken?: string; message?: string };

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const action = body.action;
    if (!action || !VALID_ACTIONS.includes(action)) return jsonNoStore({ error: 'Unknown action' }, 400);
    const version: 'cn' | 'global' = body.version === 'global' ? 'global' : 'cn';

    if (action === 'device_code') {
      const res = await fetch(`${AUTH_BASE}?taptapVersion=${version}`, { method: 'POST', cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as UpstreamCreate | null;
      if (!res.ok || !data?.qrId || !data?.verificationUrl) {
        return jsonNoStore({ error: data?.detail || data?.message || `获取二维码失败: ${res.status}` }, 502);
      }
      const flowId = randomUUID();
      flows.set(flowId, { qrId: data.qrId, version, createdAt: Date.now() });
      track();
      return jsonNoStore({
        deviceCode: data.qrId,
        userCode: '',
        qrcodeUrl: data.verificationUrl,
        verificationUrl: data.verificationUrl,
        interval: data.interval && data.interval > 0 ? data.interval : 1,
        expiresIn: data.expiresIn && data.expiresIn > 0 ? data.expiresIn : 300,
        deviceId: randomUUID(),
        flowId,
      });
    }

    const flowId = typeof body.flowId === 'string' ? body.flowId : '';
    const flow = flowId ? flows.get(flowId) : undefined;
    if (!flow || Date.now() - flow.createdAt > FLOW_TTL_MS) {
      return jsonNoStore({ error: '授权流程无效或已过期' }, 400);
    }

    if (action === 'poll_token') {
      if (flow.sessionToken) return jsonNoStore({ status: 'ok', token: {} });

      const res = await fetch(`${AUTH_BASE}/${encodeURIComponent(flow.qrId)}/status`, { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as UpstreamStatus | null;
      if (!res.ok || !data?.status) return jsonNoStore({ status: 'error', msg: `获取授权状态失败: ${res.status}` });

      switch (data.status) {
        case 'Confirmed':
          if (!data.sessionToken) return jsonNoStore({ status: 'error', msg: '上游未返回授权令牌' });
          flow.sessionToken = data.sessionToken;
          track();
          return jsonNoStore({ status: 'ok', token: {} });
        case 'Expired':
          flows.delete(flowId);
          return jsonNoStore({ status: 'denied', msg: data.message || '二维码已过期，请重新获取' });
        case 'Error':
          return jsonNoStore({ status: 'error', msg: data.message || '获取授权状态失败' });
        default:
          return jsonNoStore({ status: 'pending' });
      }
    }

    if (action === 'profile') {
      if (!flow.sessionToken) return jsonNoStore({ error: '授权尚未完成' }, 400);
      // 旧客户端会把该对象透传给 leancloud；服务端不使用其内容
      return jsonNoStore({ id: '', name: '', avatar: '', verified: false });
    }

    // action === 'leancloud'
    if (!flow.sessionToken) return jsonNoStore({ error: '授权尚未完成' }, 400);
    if (flow.used) return jsonNoStore({ error: '授权流程无效或已过期' }, 400);
    flow.used = true;
    track();
    return jsonNoStore({ sessionToken: flow.sessionToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonNoStore({ error: `登录失败：${message}` }, 500);
  }
}
