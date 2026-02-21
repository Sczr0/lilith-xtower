import { NextRequest, NextResponse } from 'next/server';

import { buildAuthRequestBody } from '@/app/lib/auth/authRequest';
import { toCredentialSummary } from '@/app/lib/auth/credentialSummary';
import { exchangeBackendToken } from '@/app/lib/auth/phi-session';
import { ensureAuthSessionKey, getAuthSession } from '@/app/lib/auth/session';
import { getSeekendApiBaseUrl } from '@/app/lib/auth/upstream';
import type { AuthCredential, TapTapVersion } from '@/app/lib/types/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GLOBAL_BAN_STATUS = 403;
const GLOBAL_BAN_CODE = 'FORBIDDEN';

type LoginRequestBody = {
  credential?: unknown;
  taptapVersion?: unknown;
};

type UpstreamErrorPayload = {
  code?: unknown;
  detail?: unknown;
  message?: unknown;
  title?: unknown;
  error?: unknown;
};

function normalizeTapTapVersion(value: unknown): TapTapVersion {
  return value === 'global' ? 'global' : 'cn';
}

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

function parseCredential(value: unknown): AuthCredential | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const type = raw.type;
  const timestamp = raw.timestamp;
  if (typeof type !== 'string' || typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return null;

  if (type === 'session') {
    const token = raw.token;
    if (typeof token !== 'string' || !token.trim()) return null;
    return { type: 'session', token, timestamp };
  }

  if (type === 'api') {
    const api_user_id = raw.api_user_id;
    const api_token = raw.api_token;
    if (typeof api_user_id !== 'string' || !api_user_id.trim()) return null;
    if (api_token !== undefined && api_token !== null && typeof api_token !== 'string') return null;
    return { type: 'api', api_user_id, api_token: api_token ?? undefined, timestamp };
  }

  if (type === 'platform') {
    const platform = raw.platform;
    const platform_id = raw.platform_id;
    if (typeof platform !== 'string' || !platform.trim()) return null;
    if (typeof platform_id !== 'string' || !platform_id.trim()) return null;
    return { type: 'platform', platform, platform_id, timestamp };
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as LoginRequestBody;
    const credential = parseCredential(body.credential);
    if (!credential) {
      return NextResponse.json(
        { success: false, message: '无效的登录凭证' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const taptapVersion = normalizeTapTapVersion(body.taptapVersion);
    const authBody = buildAuthRequestBody(credential, taptapVersion);
    const upstream = `${getSeekendApiBaseUrl()}/save`;
    const response = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(authBody),
      cache: 'no-store',
    });

    if (!response.ok) {
      const { code, detail } = await parseUpstreamError(response);

      if (response.status === GLOBAL_BAN_STATUS && code === GLOBAL_BAN_CODE) {
        const message = detail ?? '用户已被全局封禁';
        return NextResponse.json(
          { success: false, code: GLOBAL_BAN_CODE, detail: message, message },
          { status: GLOBAL_BAN_STATUS, headers: { 'Cache-Control': 'no-store' } },
        );
      }

      const isClientError = response.status >= 400 && response.status < 500;
      const message = isClientError
        ? detail ?? '登录凭证已过期或无效，请重新登录'
        : '服务器暂时无法访问，请稍后再试';
      return NextResponse.json(
        { success: false, message },
        { status: isClientError ? 401 : 502, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    let backendTokenData: { accessToken: string; expiresIn: number } | null = null;
    try {
      // authBody 中可能包含 null 字段，exchangeBackendToken 类型定义为 optional。
      // @ts-expect-error 类型兼容处理
      backendTokenData = await exchangeBackendToken(authBody);
    } catch (error) {
      console.warn('Token exchange failed (non-blocking):', error);
    }

    const session = await getAuthSession();
    ensureAuthSessionKey(session);
    session.credential = credential;
    session.taptapVersion = taptapVersion;
    session.createdAt = Date.now();

    if (backendTokenData) {
      session.backendAccessToken = backendTokenData.accessToken;
      session.backendExpAt = Date.now() + backendTokenData.expiresIn * 1000;
    }

    await session.save();

    return NextResponse.json(
      { success: true, credential: toCredentialSummary(credential), taptapVersion },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Session login error:', error);
    return NextResponse.json(
      { success: false, message: `登录失败：${message}` },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
