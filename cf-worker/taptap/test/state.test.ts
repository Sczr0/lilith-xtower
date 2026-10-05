import { describe, expect, it } from 'vitest';

import { buildScanUrl, toRetryAfterSecs } from '../src/state';

describe('buildScanUrl', () => {
  it('prefers upstream qrcode_url', () => {
    expect(
      buildScanUrl({ qrcodeUrl: 'https://accounts.taptap.cn/device?qrcode=1&user_code=uc', userCode: 'uc', verificationUrl: 'https://accounts.taptap.cn/device' }),
    ).toBe('https://accounts.taptap.cn/device?qrcode=1&user_code=uc');
  });

  it('appends user_code when qrcode_url is absent', () => {
    expect(buildScanUrl({ userCode: 'ab12', verificationUrl: 'https://accounts.taptap.cn/device' })).toBe(
      'https://accounts.taptap.cn/device?qrcode=1&user_code=ab12',
    );
    expect(buildScanUrl({ userCode: 'ab12', verificationUrl: 'https://x/device?a=1' })).toBe(
      'https://x/device?a=1&qrcode=1&user_code=ab12',
    );
  });

  it('falls back to verification_url', () => {
    expect(buildScanUrl({ verificationUrl: 'https://accounts.taptap.cn/device' })).toBe('https://accounts.taptap.cn/device');
  });
});

describe('toRetryAfterSecs', () => {
  it('rounds up and floors at 1', () => {
    expect(toRetryAfterSecs(0)).toBe(1);
    expect(toRetryAfterSecs(1)).toBe(1);
    expect(toRetryAfterSecs(1001)).toBe(2);
    expect(toRetryAfterSecs(5000)).toBe(5);
  });
});
