import { REQUIRED_AGREEMENT_VERSION, REQUIRED_PRIVACY_VERSION } from '../constants/agreement';

/**
 * 协议同意状态（版本化）。
 *
 * 设计：
 * - "当前应同意版本"由 `constants/agreement` 集中管理，bump 后全站生效。
 * - "已同意版本"写入 iron-session（见 `AuthSessionData`），作为服务端举证。
 * - 只要任一已同意版本与当前应同意版本不一致，即视为 `consentRequired`，
 *   需要让用户重新显式同意；版本一致则静默放行（cookie 过期但协议没变不会骚扰用户）。
 */
export interface ConsentStatus {
  requiredAgreementVersion: string;
  requiredPrivacyVersion: string;
  acceptedAgreementVersion: string | null;
  acceptedPrivacyVersion: string | null;
  /** 任一已同意版本落后于应同意版本时为 true。 */
  consentRequired: boolean;
}

export interface ConsentRecord {
  acceptedAgreementVersion?: string;
  acceptedPrivacyVersion?: string;
  acceptedAt?: number;
}

export function getConsentStatus(session: ConsentRecord): ConsentStatus {
  const acceptedAgreementVersion = session.acceptedAgreementVersion ?? null;
  const acceptedPrivacyVersion = session.acceptedPrivacyVersion ?? null;

  return {
    requiredAgreementVersion: REQUIRED_AGREEMENT_VERSION,
    requiredPrivacyVersion: REQUIRED_PRIVACY_VERSION,
    acceptedAgreementVersion,
    acceptedPrivacyVersion,
    consentRequired:
      acceptedAgreementVersion !== REQUIRED_AGREEMENT_VERSION ||
      acceptedPrivacyVersion !== REQUIRED_PRIVACY_VERSION,
  };
}

export function isConsentFresh(session: ConsentRecord): boolean {
  return !getConsentStatus(session).consentRequired;
}

/**
 * 将"当前应同意版本"写入会话，作为同意举证。
 * 返回写入后的 consent 状态。
 */
export function markConsentAccepted(session: ConsentRecord & { acceptedAt?: number }): ConsentStatus {
  session.acceptedAgreementVersion = REQUIRED_AGREEMENT_VERSION;
  session.acceptedPrivacyVersion = REQUIRED_PRIVACY_VERSION;
  session.acceptedAt = Date.now();
  return getConsentStatus(session);
}
