import {
  DEFAULT_TAPTAAP_VERSION,
  MIN_CN_INTERVAL_SECS,
  MIN_EXPIRES_IN_SECS,
  TAP_CONFIG,
  VALID_TAPTAAP_VERSIONS,
  type TapTapVersion,
} from './config';
import { TapTapFlow, type Env } from './flow';
import { buildScanUrl } from './state';
import { requestDeviceCode } from './tap';

export { TapTapFlow };

const CREATE_PATH = '/api/auth/qrcode';
const STATUS_RE = /^\/api\/auth\/qrcode\/([^/]+)\/status$/;
const DEFAULT_PROXY_BASE = 'https://seekend.xtower.site/api/v1';
/** 透传回源的超时（与源站上游超时一致），避免上游挂住时 Worker 无限等待。 */
const PROXY_TIMEOUT_MS = 15_000;
/** 不应转发给上游的逐跳头 / CF 私有头。 */
const STRIPPED_PROXY_HEADERS = [
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cf-worker',
  'cf-ew-via',
  'cdn-loop',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-forwarded-host',
  'x-real-ip',
];
const EDGE_HEADER = 'X-TapTap-Edge';
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  [EDGE_HEADER]: 'do',
};

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}

/** 组装 Server-Timing 头（每项保留 1 位小数）。 */
function serverTiming(metrics: Record<string, number>): string {
  return Object.entries(metrics)
    .map(([name, ms]) => `${name};dur=${ms.toFixed(1)}`)
    .join(', ');
}

/** RFC7807 风格错误（与后端一致）；同时带 message 便于前端展示。 */
function problem(status: number, code: string, detail: string, title: string): Response {
  return json({ type: 'about:blank', title, status, code, detail, message: detail }, status);
}

/** 透传 seekend：`HANDLE_MODE=proxy`（灰度/回滚）与 CN 兜底复用。 */
async function proxyToSeekend(request: Request, env: Env): Promise<Response> {
  const base = (env.PROXY_BASE ?? DEFAULT_PROXY_BASE).replace(/\/+$/, '');
  const url = new URL(request.url);
  const target = `${base}${url.pathname.replace(/^\/api/, '')}${url.search}`;

  const headers = new Headers(request.headers);
  for (const name of STRIPPED_PROXY_HEADERS) headers.delete(name);
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();
  const t0 = performance.now();
  try {
    const res = await fetch(target, {
      method: request.method,
      headers,
      body,
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });
    const out = new Headers(res.headers);
    out.set(EDGE_HEADER, 'proxy');
    out.set('Server-Timing', serverTiming({ proxy: performance.now() - t0 }));
    return new Response(res.body, { status: res.status, headers: out });
  } catch (err) {
    const detail = err instanceof Error ? err.message : '回源失败';
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || /abort|timeout/i.test(err.message));
    return timedOut
      ? problem(504, 'UPSTREAM_TIMEOUT', detail, 'Upstream Timeout')
      : problem(502, 'UPSTREAM_ERROR', detail, 'Upstream Error');
  }
}

async function handleCreate(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const raw = url.searchParams.get('taptapVersion');

  let version: TapTapVersion = DEFAULT_TAPTAAP_VERSION;
  if (raw != null && raw.trim() !== '') {
    const normalized = raw.trim().toLowerCase();
    if (!(VALID_TAPTAAP_VERSIONS as readonly string[]).includes(normalized)) {
      return problem(422, 'VALIDATION_FAILED', 'taptapVersion 必须为 cn 或 global', 'Validation Failed');
    }
    version = normalized as TapTapVersion;
  }

  const deviceId = crypto.randomUUID();
  const qrId = crypto.randomUUID();
  const startedAt = performance.now();

  try {
    const device = await requestDeviceCode(TAP_CONFIG[version], deviceId);
    const upstreamMs = performance.now() - startedAt;
    // cn 版本在海外：上游在国内，跨境轮询贵 → 放大间隔（global 保持上游给的间隔）
    const intervalSec = version === 'cn' ? Math.max(device.interval, MIN_CN_INTERVAL_SECS) : device.interval;
    // 有效期下限只在此处 clamp 一次，DO 状态与响应共用同一值，避免两端不一致。
    const expiresIn = Math.max(MIN_EXPIRES_IN_SECS, device.expiresIn);
    await env.TAP_FLOW.getByName(qrId).create({
      version,
      deviceId,
      deviceCode: device.deviceCode,
      intervalSec,
      expiresInSec: expiresIn,
    });
    // 不返回 qrcodeBase64：客户端用 verificationUrl 自行渲染二维码（少一个边缘 QR 依赖）。
    return json(
      { qrId, verificationUrl: buildScanUrl(device), expiresIn, interval: intervalSec },
      200,
      { 'Server-Timing': serverTiming({ upstream: upstreamMs, app: performance.now() - startedAt }) },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const name = err instanceof Error ? err.name : '';
    if (name === 'AuthError') return problem(401, 'UNAUTHORIZED', message, 'Unauthorized');
    if (name === 'TimeoutError') return problem(504, 'UPSTREAM_TIMEOUT', message, 'Upstream Timeout');
    if (name === 'NetworkError') return problem(502, 'UPSTREAM_ERROR', message, 'Upstream Error');
    return problem(500, 'INTERNAL_ERROR', message, 'Internal Error');
  }
}

async function handleStatus(env: Env, qrId: string): Promise<Response> {
  const t0 = performance.now();
  const { res, upstreamMs } = await env.TAP_FLOW.getByName(qrId).status();
  return json(res, 200, { 'Server-Timing': serverTiming({ upstream: upstreamMs, do: performance.now() - t0 }) });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 分流：proxy 模式，或请求来自国内（CN）→ 透传 seekend，保持「国内走原链路」。
    const country = (request as { cf?: { country?: string } }).cf?.country;
    const cn = (env.CN_FALLBACK_COUNTRIES ?? '')
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    if (env.HANDLE_MODE === 'proxy' || (country ? cn.includes(country.toUpperCase()) : false)) {
      return proxyToSeekend(request, env);
    }

    if (url.pathname === CREATE_PATH && request.method === 'POST') {
      return handleCreate(request, env);
    }
    const matched = STATUS_RE.exec(url.pathname);
    if (matched && request.method === 'GET') {
      let qrId: string;
      try {
        qrId = decodeURIComponent(matched[1]);
      } catch {
        return problem(400, 'VALIDATION_FAILED', '非法的二维码 ID', 'Validation Failed');
      }
      return handleStatus(env, qrId);
    }

    return problem(404, 'NOT_FOUND', 'Not Found', 'Not Found');
  },
} satisfies ExportedHandler<Env>;
