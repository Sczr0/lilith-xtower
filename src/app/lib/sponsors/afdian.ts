import crypto from 'crypto';
import { unstable_cache } from 'next/cache';

import type { SponsorsApiResponse } from '../types/sponsors';

export type AfdianSponsorsResult = {
  ok: boolean;
  status: number;
  payload: SponsorsApiResponse;
};

type AfdianCredentials = {
  userId: string;
  token: string;
};

const AFDIAN_API_URL = 'https://afdian.com/api/open/query-sponsor';
const DEFAULT_CONFIG_ERROR: SponsorsApiResponse = {
  ec: 503,
  em: 'Server config missing: set AFDIAN_USER_ID and AFDIAN_TOKEN in env',
};

function md5(input: string) {
  return crypto.createHash('md5').update(input).digest('hex');
}

function getAfdianCredentialsFromEnv(): AfdianCredentials | null {
  const userId = process.env.AFDIAN_USER_ID;
  const token = process.env.AFDIAN_TOKEN;
  if (!userId || !token) return null;
  return { userId, token };
}

async function fetchAfdianSponsors(
  page: number,
  perPage: number,
  filterUserIds?: string,
): Promise<AfdianSponsorsResult> {
  const credentials = getAfdianCredentialsFromEnv();
  if (!credentials) {
    return { ok: false, status: 503, payload: DEFAULT_CONFIG_ERROR };
  }

  const ts = Math.floor(Date.now() / 1000);
  const paramsObj: Record<string, unknown> = { page, per_page: perPage };
  if (filterUserIds) paramsObj.user_id = filterUserIds;
  const paramsStr = JSON.stringify(paramsObj);

  const kvString = `params${paramsStr}ts${ts}user_id${credentials.userId}`;
  const sign = md5(`${credentials.token}${kvString}`);

  try {
    const res = await fetch(AFDIAN_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: credentials.userId,
        params: paramsStr,
        ts,
        sign,
      }),
      cache: 'no-store',
    });

    const payload = (await res.json().catch(() => null)) as SponsorsApiResponse | null;
    const safePayload: SponsorsApiResponse = payload && typeof payload === 'object'
      ? payload
      : { ec: res.status, em: 'Invalid upstream response' };

    if (!res.ok) {
      return { ok: false, status: res.status, payload: safePayload };
    }

    return { ok: true, status: res.status, payload: safePayload };
  } catch (error) {
    return { ok: false, status: 500, payload: { ec: 500, em: 'fetch sponsors failed', data: undefined } };
  }
}

/**
 * Afdian Sponsors 查询结果缓存（服务端）
 * - 用于减少上游请求，并支撑页面 SSR/ISR 首屏直出
 */
export const fetchAfdianSponsorsCached = unstable_cache(
  async (page: number, perPage: number, filterUserIds?: string) => fetchAfdianSponsors(page, perPage, filterUserIds),
  ['afdian-sponsors'],
  { revalidate: 300 },
);

