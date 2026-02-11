import { NextRequest } from 'next/server';

type RumPrefetchPayload = {
  t?: number;
  path?: string;
  cacheCount?: number;
  hitCount?: number;
  hitRate?: number;
  cacheKeys?: string[];
  hitKeys?: string[];
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
};

function clampNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function sanitizeKeys(value: unknown, maxItems: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    out.push(trimmed.length > 64 ? trimmed.slice(0, 64) : trimmed);
    if (out.length >= maxItems) break;
  }
  return out.length ? out : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return new Response('Bad Request', { status: 400 });
    }

    const raw = await req.json();
    const data = (typeof raw === 'object' && raw !== null ? raw : {}) as RumPrefetchPayload;

    const t = clampNumber(data.t, 0, Date.now() + 60_000) ?? Date.now();
    const path = typeof data.path === 'string' ? (data.path.length > 1024 ? data.path.slice(0, 1024) : data.path) : undefined;

    const cacheCount = clampNumber(data.cacheCount, 0, 200) ?? 0;
    const hitCount = clampNumber(data.hitCount, 0, 200) ?? 0;
    const hitRate = clampNumber(data.hitRate, 0, 1) ?? (cacheCount ? hitCount / cacheCount : 0);

    const cacheKeys = sanitizeKeys(data.cacheKeys, 20);
    const hitKeys = sanitizeKeys(data.hitKeys, 20);

    const deviceMemory = clampNumber(data.deviceMemory, 0, 128);
    const hardwareConcurrency = clampNumber(data.hardwareConcurrency, 0, 256);

    const connection = (() => {
      const c = data.connection;
      if (!c || typeof c !== 'object') return undefined;
      return {
        effectiveType: typeof c.effectiveType === 'string' ? c.effectiveType.slice(0, 16) : undefined,
        downlink: clampNumber(c.downlink, 0, 10_000),
        rtt: clampNumber(c.rtt, 0, 60_000),
        saveData: typeof c.saveData === 'boolean' ? c.saveData : undefined,
      };
    })();

    // 轻量日志：用于评估预取命中率与设备/网络画像（可替换为投递 Axiom/DB）。
    try {
      const ua = req.headers.get('user-agent') || '';
      const country = req.headers.get('x-vercel-ip-country') || undefined;
      console.log(
        `[prefetch-rum] t=${t} path=${path ?? ''} cache=${cacheCount} hit=${hitCount} rate=${hitRate.toFixed(3)} net=${
          connection?.effectiveType ?? ''
        }/${connection?.downlink ?? ''}Mbps rtt=${connection?.rtt ?? ''} saveData=${connection?.saveData ?? ''} mem=${
          deviceMemory ?? ''
        }GB cpu=${hardwareConcurrency ?? ''} ua=${ua.slice(0, 80)} country=${country ?? ''} cacheKeys=${(cacheKeys ?? []).join(',')} hitKeys=${(hitKeys ?? []).join(',')}`
      );
    } catch {}

    // 无正文 204，便于 sendBeacon 快速返回
    return new Response(null, { status: 204 });
  } catch {}

  return new Response(null, { status: 204 });
}
