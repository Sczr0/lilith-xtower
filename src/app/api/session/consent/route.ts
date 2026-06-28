import { NextResponse } from 'next/server';

import { getConsentStatus, markConsentAccepted } from '@/app/lib/auth/consent';
import { getAuthSession } from '@/app/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/session/consent
 *
 * 用户在协议确认弹窗中显式同意后调用。
 * 将"当前应同意版本"写入 iron-session 作为同意举证，并返回最新 consent 状态。
 *
 * 说明：
 * - 不接受客户端传入的版本号，服务端始终写入 `constants/agreement` 中的当前应同意版本，
 *   避免客户端伪造旧版本绕过重新同意。
 * - 必须存在已认证会话；未登录调用返回 401。
 */
export async function POST() {
  try {
    const session = await getAuthSession();

    if (!session.credential) {
      return NextResponse.json(
        { success: false, message: '未登录，无法记录同意状态' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    markConsentAccepted(session);
    await session.save();

    const consent = getConsentStatus(session);
    return NextResponse.json(
      {
        success: true,
        requiredAgreementVersion: consent.requiredAgreementVersion,
        requiredPrivacyVersion: consent.requiredPrivacyVersion,
        acceptedAgreementVersion: consent.acceptedAgreementVersion,
        acceptedPrivacyVersion: consent.acceptedPrivacyVersion,
        consentRequired: consent.consentRequired,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Session consent error:', error);
    return NextResponse.json(
      { success: false, message: `记录同意状态失败：${message}` },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
