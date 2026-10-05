/**
 * 边缘可达性探测：从 Cloudflare 边缘去 fetch TapTap / LeanCloud 上游，判断
 * 「cn 版本能不能放在边缘跑」（CF 到国内的链路常常不可达或很差）。
 *
 * 用法：部署后 GET /?key=<PROBE_KEY>[&group=backend|current][&only=cn|global]
 *
 * 两组目标：
 * - backend：后端（Next-Phi-Backend `config.example.toml`）实际使用的端点 —— 若我们要"薅"后端模块，
 *   就该以这组为准。
 * - current：本站 shared/taptap-config.json（源站 route）使用的端点，仅作对比。
 */

type Version = 'cn' | 'global';
type Group = 'backend' | 'current';

type Endpoints = {
  device: string;
  token: string;
  userInfo: string;
  leancloud: string;
  clientId: string;
};

const GROUPS: Record<Group, Record<Version, Endpoints>> = {
  backend: {
    cn: {
      device: 'https://www.taptap.com/oauth2/v1/device/code',
      token: 'https://www.taptap.cn/oauth2/v1/token',
      userInfo: 'https://open.tapapis.cn/account/basic-info/v1',
      leancloud: 'https://rak3ffdi.cloud.tds1.tapapis.cn/1.1',
      clientId: 'rAK3FfdieFob2Nn8Am',
    },
    global: {
      device: 'https://www.taptap.io/oauth2/v1/device/code',
      token: 'https://www.taptap.io/oauth2/v1/token',
      userInfo: 'https://open.tapapis.io/account/basic-info/v1',
      leancloud: 'https://kviehlel.cloud.ap-sg.tapapis.com/1.1',
      clientId: 'kviehleldgxsagpozb',
    },
  },
  current: {
    cn: {
      device: 'https://accounts.tapapis.cn/oauth2/v1/device/code',
      token: 'https://accounts.tapapis.cn/oauth2/v1/token',
      userInfo: 'https://open.tapapis.cn/account/basic-info/v1',
      leancloud: 'https://rak3ffdi.cloud.tds1.tapapis.cn/1.1',
      clientId: 'rAK3FfdieFob2Nn8Am',
    },
    global: {
      device: 'https://accounts.tapapis.com/oauth2/v1/device/code',
      token: 'https://accounts.tapapis.com/oauth2/v1/token',
      userInfo: 'https://open.tapapis.com/account/basic-info/v1',
      leancloud: 'https://kviehlel.cloud.ap-sg.tapapis.com/1.1',
      clientId: 'kviehleldgxsagpozb',
    },
  },
};

const TIMEOUT_MS = 12_000;
const MAX_SNIPPET = 240;

interface Env {
  /** 必需：探测走公网且会打真实上游，用一个共享密钥挡住滥用。 */
  PROBE_KEY: string;
}

type ProbeResult = {
  name: string;
  url: string;
  ok: boolean;
  status: number | null;
  ms: number;
  snippet?: string;
  error?: string;
};

async function probe(name: string, method: string, url: string, init: RequestInit = {}): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      method,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const ms = Date.now() - t0;
    let snippet = '';
    try {
      snippet = (await res.text()).slice(0, MAX_SNIPPET);
    } catch {
      // 忽略 body 读取失败：连通性已证明
    }
    return { name, url, ok: true, status: res.status, ms, snippet };
  } catch (err) {
    return {
      name,
      url,
      ok: false,
      status: null,
      ms: Date.now() - t0,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
  }
}

function buildTargets(groups: Group[], versions: Version[]) {
  const targets: Array<{ name: string; method: string; url: string; init: RequestInit }> = [];
  const form = (o: Record<string, string>) => new URLSearchParams(o).toString();

  for (const g of groups) {
    for (const v of versions) {
      const e = GROUPS[g][v];
      // 设备码：真实表单 —— 与后端 TapTapClient 一致（scope=basic_info, version=1.2.0）
      targets.push({
        name: `${g}:${v}:device_code`,
        method: 'POST',
        url: e.device,
        init: {
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: form({
            client_id: e.clientId,
            response_type: 'device_code',
            scope: 'basic_info',
            version: '1.2.0',
            platform: 'unity',
            // 后端用 Uuid::new_v4()：global 会校验 device_id 格式，非 UUID 会被 access_denied
            info: JSON.stringify({ device_id: crypto.randomUUID() }),
          }),
        },
      });
      // 令牌端点：故意用无效 code，拿到任意 HTTP 响应即证明可达
      targets.push({
        name: `${g}:${v}:token_reach`,
        method: 'POST',
        url: e.token,
        init: {
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: form({
            grant_type: 'device_token',
            client_id: e.clientId,
            secret_type: 'hmac-sha-1',
            code: 'probe-invalid',
            version: '1.0',
            platform: 'unity',
            info: JSON.stringify({ device_id: 'probe' }),
          }),
        },
      });
      // 用户信息端点（无鉴权 → 期望 401/403，证明可达）
      targets.push({ name: `${g}:${v}:user_info`, method: 'GET', url: e.userInfo, init: {} });
      // LeanCloud 根
      targets.push({ name: `${g}:${v}:leancloud`, method: 'GET', url: e.leancloud, init: {} });
    }
  }
  return targets;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!env.PROBE_KEY) return json({ error: 'PROBE_KEY 未配置' }, 503);

    const key = url.searchParams.get('key') ?? request.headers.get('x-probe-key') ?? '';
    if (key !== env.PROBE_KEY) return json({ error: 'unauthorized' }, 401);

    const groupParam = url.searchParams.get('group');
    const groups: Group[] =
      groupParam === 'backend' || groupParam === 'current' ? [groupParam] : ['backend', 'current'];
    const onlyParam = url.searchParams.get('only');
    const versions: Version[] = onlyParam === 'cn' || onlyParam === 'global' ? [onlyParam] : ['cn', 'global'];

    const started = Date.now();
    const results = await Promise.all(
      buildTargets(groups, versions).map((t) => probe(t.name, t.method, t.url, t.init)),
    );

    const cf = (request as { cf?: { colo?: string; country?: string; city?: string } }).cf;
    return json({
      edge: { colo: cf?.colo ?? null, country: cf?.country ?? null, city: cf?.city ?? null },
      totalMs: Date.now() - started,
      results,
    });
  },
} satisfies ExportedHandler<Env>;
