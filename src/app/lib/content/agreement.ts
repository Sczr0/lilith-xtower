import 'server-only';

import fs from 'fs';
import path from 'path';

import { computeWeakEtag } from '../utils/httpCache';

/**
 * 用户协议文本的读取与进程内存缓存。
 *
 * 说明：
 * - 读盘只在缓存 miss 时发生；缓存 TTL 短于路由的 revalidate=600，
 *   仅用于消除同一 ISR 周期内的重复读盘。
 * - 此前该缓存永不失效，导致协议更新后必须重启进程才生效；
 *   现在既有 60s TTL 兜底，也可由 /api/internal/cache 的 purge 主动失效。
 */

const AGREEMENT_FILE_PATH = path.join(process.cwd(), 'src', 'app', 'agreement', 'agreement.md');
const ENABLE_PROD_CACHE = process.env.NODE_ENV === 'production';
const AGREEMENT_CACHE_TTL_MS = 60 * 1000;

let cachedAgreement: { content: string; etag: string; ts: number } | null = null;

export function readAgreement(): { content: string; etag: string } {
  const now = Date.now();
  if (ENABLE_PROD_CACHE && cachedAgreement && now - cachedAgreement.ts < AGREEMENT_CACHE_TTL_MS) {
    return cachedAgreement;
  }
  const content = fs.readFileSync(AGREEMENT_FILE_PATH, 'utf8');
  const etag = computeWeakEtag(content);
  const result = { content, etag, ts: now };
  if (ENABLE_PROD_CACHE) cachedAgreement = result;
  return result;
}

/** 主动失效进程内存缓存（供 /api/internal/cache 的 purge 调用）。 */
export function invalidateAgreementCache(): void {
  cachedAgreement = null;
}
