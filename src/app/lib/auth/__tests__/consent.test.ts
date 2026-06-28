import { describe, expect, it } from 'vitest';

import {
  getConsentStatus,
  isConsentFresh,
  markConsentAccepted,
} from '../consent';
import { REQUIRED_AGREEMENT_VERSION, REQUIRED_PRIVACY_VERSION } from '../../constants/agreement';

describe('auth/consent', () => {
  it('treats empty session as consent-required', () => {
    const status = getConsentStatus({});
    expect(status.requiredAgreementVersion).toBe(REQUIRED_AGREEMENT_VERSION);
    expect(status.requiredPrivacyVersion).toBe(REQUIRED_PRIVACY_VERSION);
    expect(status.acceptedAgreementVersion).toBe(null);
    expect(status.acceptedPrivacyVersion).toBe(null);
    expect(status.consentRequired).toBe(true);
    expect(isConsentFresh({})).toBe(false);
  });

  it('treats matching versions as fresh', () => {
    const status = getConsentStatus({
      acceptedAgreementVersion: REQUIRED_AGREEMENT_VERSION,
      acceptedPrivacyVersion: REQUIRED_PRIVACY_VERSION,
      acceptedAt: 123,
    });
    expect(status.consentRequired).toBe(false);
    expect(isConsentFresh({
      acceptedAgreementVersion: REQUIRED_AGREEMENT_VERSION,
      acceptedPrivacyVersion: REQUIRED_PRIVACY_VERSION,
    })).toBe(true);
  });

  it('requires re-consent when agreement version drifts', () => {
    expect(
      getConsentStatus({
        acceptedAgreementVersion: '2020-01-01',
        acceptedPrivacyVersion: REQUIRED_PRIVACY_VERSION,
      }).consentRequired,
    ).toBe(true);
  });

  it('requires re-consent when privacy version drifts', () => {
    expect(
      getConsentStatus({
        acceptedAgreementVersion: REQUIRED_AGREEMENT_VERSION,
        acceptedPrivacyVersion: '2020-01-01',
      }).consentRequired,
    ).toBe(true);
  });

  it('markConsentAccepted writes current required versions and clears requirement', () => {
    const session: { acceptedAgreementVersion?: string; acceptedPrivacyVersion?: string; acceptedAt?: number } = {};
    const status = markConsentAccepted(session);
    expect(session.acceptedAgreementVersion).toBe(REQUIRED_AGREEMENT_VERSION);
    expect(session.acceptedPrivacyVersion).toBe(REQUIRED_PRIVACY_VERSION);
    expect(typeof session.acceptedAt).toBe('number');
    expect(status.consentRequired).toBe(false);
  });
});
