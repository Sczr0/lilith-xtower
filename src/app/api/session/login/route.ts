import { NextRequest, NextResponse } from 'next/server';

import { buildAuthRequestBody } from '@/app/lib/auth/authRequest';
import { toCredentialSummary } from '@/app/lib/auth/credentialSummary';
import { getConsentStatus } from '@/app/lib/auth/consent';
import { exchangeBackendToken } from '@/app/lib/auth/phi-session';
import { ensureAuthSessionKey, getAuthSession } from '@/app/lib/auth/session';
import { getSeekendApiBaseUrl } from '@/app/lib/auth/upstream';
import { upstreamFetch } from '@/app/lib/api/upstreamFetch';
import type { AuthCredential, TapTapVersion } from '@/app/lib/types/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GLOBAL_BAN_STATUS = 403;
const GLOBAL_BAN_CODE = 'FORBIDDEN';

type LoginRequestBody = {
  credential?: unknown;
  taptapVersion?: unknown;
  capToken?: unknown;
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

    // token 交换与 /save 校验彼此独立（都只依赖 authBody），并行发起以省掉一跳延迟。
    // 内部自行捕获错误并降级为 null；/save 失败时其结果会被丢弃，不影响响应。
    const backendTokenPromise: Promise<{ accessToken: string; expiresIn: number } | null> = (async () => {
      try {
        // authBody 中可能包含 null 字段，exchangeBackendToken 类型定义为 optional。
        // @ts-expect-error 类型兼容处理
        return await exchangeBackendToken(authBody);
      } catch (error) {
        console.warn('Token exchange failed (non-blocking):', error);
        return null;
      }
    })();

    const response = await upstreamFetch(
      upstream,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(authBody),
        cache: 'no-store',
      },
      { timeoutMs: 15_000 },
    );

    if (!response.ok) {
      const { code } = await parseUpstreamError(response);

      if (response.status === GLOBAL_BAN_STATUS && code === GLOBAL_BAN_CODE) {
        // 说明：仅回传受控错误码，不回显上游 detail（避免泄露内部信息/封禁判定细节）。
        return NextResponse.json(
          { success: false, code: GLOBAL_BAN_CODE, message: '用户已被全局封禁' },
          { status: GLOBAL_BAN_STATUS, headers: { 'Cache-Control': 'no-store' } },
        );
      }

      const isClientError = response.status >= 400 && response.status < 500;
      const message = isClientError
        ? '登录凭证已过期或无效，请重新登录'
        : '服务器暂时无法访问，请稍后再试';
      return NextResponse.json(
        { success: false, message },
        { status: isClientError ? 401 : 502, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const backendTokenData = await backendTokenPromise;

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

    const consent = getConsentStatus(session);
    return NextResponse.json(
      {
        success: true,
        credential: toCredentialSummary(credential),
        taptapVersion,
        requiredAgreementVersion: consent.requiredAgreementVersion,
        requiredPrivacyVersion: consent.requiredPrivacyVersion,
        acceptedAgreementVersion: consent.acceptedAgreementVersion,
        acceptedPrivacyVersion: consent.acceptedPrivacyVersion,
        // 刚建立的会话尚未同意任何版本，故必然需要确认。
        consentRequired: consent.consentRequired,
      },
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
