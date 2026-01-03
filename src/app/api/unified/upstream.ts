import type { NextRequest } from 'next/server';

const DEFAULT_FALLBACK_BASE_URL = 'https://seekend.xtower.site';
const DEFAULT_LOCAL_BASE_URL = 'http://127.0.0.1:3930';

const DEFAULT_PROBE_TIMEOUT_MS = 300;
const DEFAULT_TTL_OK_MS = 30_000;
const DEFAULT_TTL_FAIL_MS = 3_000;

type CacheState = { value: string; expiresAt: number };

let cached: CacheState | null = null;
let inflight: Promise<string> | null = null;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function parseEnvNumber(name: string, fallback: number): number {
  const raw = (process.env[name] ?? '').trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0) return fallback;
  return parsed;
}

function parseEnvSwitch01(name: string): 'force_on' | 'force_off' | 'auto' {
  const raw = (process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return 'auto';
  if (raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes') return 'force_on';
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return 'force_off';
  return 'auto';
}

function isLoopbackHost(host: string): boolean {
  const hostname = host.split(':')[0]?.toLowerCase() ?? '';
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

function shouldEnableLocalProbe(req: NextRequest): boolean {
  const mode = parseEnvSwitch01('UNIFIED_API_LOCAL_PROBE');
  if (mode === 'force_on') return true;
  if (mode === 'force_off') return false;

  const host = req.headers.get('host') ?? req.nextUrl.host;
  if (!host) return false;
  return isLoopbackHost(host);
}

async function probeHttpReachable(baseUrl: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 探针只关心“是否存在 HTTP 服务在监听”，不依赖任何特定健康检查接口。
    // 只要能拿到任意 HTTP 响应（无论状态码），即认为本地后端可用。
    await fetch(`${baseUrl}/`, { method: 'HEAD', signal: controller.signal, cache: 'no-store' });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function getFallbackBaseUrl(): string {
  const fallback = process.env.UNIFIED_API_BASE_URL || DEFAULT_FALLBACK_BASE_URL;
  return normalizeBaseUrl(fallback);
}

function getLocalBaseUrl(): string {
  const local = process.env.UNIFIED_API_LOCAL_BASE_URL || DEFAULT_LOCAL_BASE_URL;
  return normalizeBaseUrl(local);
}

export async function resolveUnifiedApiUpstreamBaseUrl(req: NextRequest): Promise<string> {
  const fallback = getFallbackBaseUrl();
  if (!shouldEnableLocalProbe(req)) return fallback;

  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  if (inflight) return inflight;

  const timeoutMs = parseEnvNumber('UNIFIED_API_LOCAL_PROBE_TIMEOUT_MS', DEFAULT_PROBE_TIMEOUT_MS);
  const ttlOkMs = parseEnvNumber('UNIFIED_API_LOCAL_PROBE_TTL_OK_MS', DEFAULT_TTL_OK_MS);
  const ttlFailMs = parseEnvNumber('UNIFIED_API_LOCAL_PROBE_TTL_FAIL_MS', DEFAULT_TTL_FAIL_MS);

  const localBaseUrl = getLocalBaseUrl();

  inflight = (async () => {
    const ok = await probeHttpReachable(localBaseUrl, timeoutMs);
    const value = ok ? localBaseUrl : fallback;
    const ttl = ok ? ttlOkMs : ttlFailMs;
    cached = { value, expiresAt: Date.now() + ttl };
    return value;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}
