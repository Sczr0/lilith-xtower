import { NextResponse } from 'next/server';

import { buildAuthRequestBody } from '@/app/lib/auth/authRequest';
import { getAuthSession } from '@/app/lib/auth/session';
import { getSeekendApiBaseUrl } from '@/app/lib/auth/upstream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GLOBAL_BAN_STATUS = 403;
const GLOBAL_BAN_CODE = 'FORBIDDEN';

type ValidateResponse = {
  isValid: boolean;
  shouldLogout: boolean;
  error?: string;
  code?: string;
};

type UpstreamErrorPayload = {
  code?: unknown;
  detail?: unknown;
  message?: unknown;
  title?: unknown;
  error?: unknown;
};

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

async function parseUpstreamError(response: Response): Promise<{ code: string | null; detail: string | null }> {
  try {
    const payload = (await response.json()) as UpstreamErrorPayload;
    return {
      code: toNonEmptyString(payload?.code),
      detail:
        toNonEmptyString(payload?.detail) ??
        toNonEmptyString(payload?.message) ??
        toNonEmptyString(payload?.title) ??
        toNonEmptyString(payload?.error),
    };
  } catch {
    return { code: null, detail: null };
  }
}

export async function POST() {
  try {
    const session = await getAuthSession();
    const credential = session.credential;
    const taptapVersion = session.taptapVersion ?? 'cn';

    if (!credential) {
      const payload: ValidateResponse = {
        isValid: false,
        shouldLogout: true,
        error: '未登录',
      };
      return NextResponse.json(payload, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }

    const authBody = buildAuthRequestBody(credential, taptapVersion);
    const upstream = `${getSeekendApiBaseUrl()}/save`;
    const response = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(authBody),
      cache: 'no-store',
    });

    if (response.ok) {
      const payload: ValidateResponse = { isValid: true, shouldLogout: false };
      return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
    }

    const { code, detail } = await parseUpstreamError(response);
    if (response.status === GLOBAL_BAN_STATUS && code === GLOBAL_BAN_CODE) {
      session.destroy();
      const payload: ValidateResponse = {
        isValid: false,
        shouldLogout: true,
        code: GLOBAL_BAN_CODE,
        error: detail ?? '用户已被全局封禁',
      };
      return NextResponse.json(payload, {
        status: GLOBAL_BAN_STATUS,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    if (response.status >= 400 && response.status < 500) {
      session.destroy();
      const payload: ValidateResponse = {
        isValid: false,
        shouldLogout: true,
        error: detail ?? '登录凭证已过期或无效，请重新登录',
      };
      return NextResponse.json(payload, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }

    const payload: ValidateResponse = {
      isValid: false,
      shouldLogout: false,
      error: '服务器暂时无法访问，请稍后再试',
    };
    return NextResponse.json(payload, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Session validate error:', error);
    return NextResponse.json(
      { isValid: false, shouldLogout: false, error: `验证失败：${message}` },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
