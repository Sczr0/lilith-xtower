import { DEFAULT_TAPTAAP_VERSION, TAP_CONFIG, VALID_TAPTAAP_VERSIONS, type TapTapVersion } from './config';
import { TapTapFlow, type Env } from './flow';
import { buildScanUrl } from './state';
import { requestDeviceCode } from './tap';

export { TapTapFlow };

const CREATE_PATH = '/api/auth/qrcode';
const STATUS_RE = /^\/api\/auth\/qrcode\/([^/]+)\/status$/;
const DEFAULT_PROXY_BASE = 'https://seekend.xtower.site/api/v1';
const EDGE_HEADER = 'X-TapTap-Edge';
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  [EDGE_HEADER]: 'do',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
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
  headers.delete('host');
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();
  try {
    const res = await fetch(target, { method: request.method, headers, body });
    const out = new Headers(res.headers);
    out.set(EDGE_HEADER, 'proxy');
    return new Response(res.body, { status: res.status, headers: out });
  } catch (err) {
    return problem(502, 'UPSTREAM_ERROR', err instanceof Error ? err.message : '回源失败', 'Upstream Error');
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

  try {
    const device = await requestDeviceCode(TAP_CONFIG[version], deviceId);
    await env.TAP_FLOW.getByName(qrId).create({
      version,
      deviceId,
      deviceCode: device.deviceCode,
      intervalSec: device.interval,
      expiresInSec: device.expiresIn,
    });
    // 不返回 qrcodeBase64：客户端用 verificationUrl 自行渲染二维码（少一个边缘 QR 依赖）。
    return json({ qrId, verificationUrl: buildScanUrl(device), expiresIn: device.expiresIn, interval: device.interval });
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
  const result = await env.TAP_FLOW.getByName(qrId).status();
  return json(result);
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
      return handleStatus(env, decodeURIComponent(matched[1]));
    }

    return problem(404, 'NOT_FOUND', 'Not Found', 'Not Found');
  },
} satisfies ExportedHandler<Env>;
