import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

import { invalidateContentCache } from '@/app/lib/content/parser';
import { invalidateQACache } from '@/app/lib/qa';
import { clearPublicProxyCache } from '@/app/lib/api/publicProxyCache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 缓存 purge 管理端点（内容发布 / 上游数据变更后的主动失效闭环）。
 *
 * 用法：
 *   GET  /api/internal/cache                    列出可用的 tag
 *   POST /api/internal/cache                    { "tags": ["qa"], "paths": ["/api/public/profile/xxx"] }
 *   鉴权：Authorization: Bearer <CACHE_ADMIN_TOKEN>
 *
 * 说明：
 * - 未配置 CACHE_ADMIN_TOKEN 时一律拒绝（避免开发默认值泄漏到生产）；
 * - tags 覆盖固定资源组；paths 接受具体 URL（含动态段，如单个公开档案）；
 * - 所有 purge 都会同步清空进程内缓存层（内容 / QA / 公开代理缓存），
 *   ISR/Data Cache 交给 revalidatePath/revalidateTag。
 */

const TAG_HANDLERS: Record<string, () => void> = {
  announcements: () => {
    revalidatePath('/api/content/announcements');
  },
  'song-updates': () => {
    revalidatePath('/api/content/song-updates');
  },
  qa: () => {
    revalidatePath('/api/qa');
    revalidatePath('/qa');
  },
  agreement: () => {
    revalidatePath('/api/agreement');
    revalidatePath('/agreement');
  },
  sponsors: () => {
    // Next 16：revalidateTag 需要第二个 cache profile 参数（'max' 为推荐的 purge 语义）
    revalidateTag('afdian-sponsors', 'max');
    revalidatePath('/sponsors');
    revalidatePath('/internal/sponsors');
  },
  // 排行榜/公开档案走 catch-all 代理（force-dynamic），无 ISR 缓存可失效，
  // 其"缓存"即代理内存层，统一由下方的 clearPublicProxyCache 清空
  leaderboard: () => {},
};

function isAuthorized(request: NextRequest): boolean {
  const expected = (process.env.CACHE_ADMIN_TOKEN ?? '').trim();
  if (!expected) return false;

  const auth = request.headers.get('authorization') ?? '';
  const prefix = 'Bearer ';
  if (!auth.startsWith(prefix)) return false;

  const provided = auth.slice(prefix.length);
  const a = Buffer.from(provided, 'utf-8');
  const b = Buffer.from(expected, 'utf-8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function unauthorized() {
  const configured = Boolean((process.env.CACHE_ADMIN_TOKEN ?? '').trim());
  return NextResponse.json(
    { error: configured ? 'unauthorized' : 'CACHE_ADMIN_TOKEN is not configured' },
    { status: configured ? 401 : 503 },
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();

  return NextResponse.json({
    tags: Object.keys(TAG_HANDLERS),
    note: 'POST { "tags": [...], "paths": [...] } to purge; Authorization: Bearer <CACHE_ADMIN_TOKEN>',
  });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();

  let body: { tags?: unknown; paths?: unknown };
  try {
    body = (await request.json()) as { tags?: unknown; paths?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === 'string') : [];
  const paths = Array.isArray(body.paths) ? body.paths.filter((p): p is string => typeof p === 'string') : [];

  if (tags.length === 0 && paths.length === 0) {
    return NextResponse.json({ error: 'nothing to purge: provide tags and/or paths' }, { status: 400 });
  }

  const results: { target: string; ok: boolean; error?: string }[] = [];

  for (const tag of tags) {
    const handler = TAG_HANDLERS[tag];
    if (!handler) {
      results.push({ target: `tag:${tag}`, ok: false, error: 'unknown tag' });
      continue;
    }
    try {
      handler();
      results.push({ target: `tag:${tag}`, ok: true });
    } catch (e) {
      results.push({ target: `tag:${tag}`, ok: false, error: String(e) });
    }
  }

  for (const path of paths) {
    try {
      revalidatePath(path);
      results.push({ target: `path:${path}`, ok: true });
    } catch (e) {
      results.push({ target: `path:${path}`, ok: false, error: String(e) });
    }
  }

  if (results.some((r) => r.ok)) {
    // 同步清空进程内存层，保证本实例立即生效（多实例需逐实例调用或依赖短 TTL 自然过期）
    invalidateContentCache();
    invalidateQACache();
    clearPublicProxyCache();
  }

  return NextResponse.json({ results });
}
