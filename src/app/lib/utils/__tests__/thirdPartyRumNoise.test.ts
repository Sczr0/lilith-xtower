import { describe, it, expect } from 'vitest';

import { isThirdPartyRumNoise } from '../thirdPartyRumNoise';

describe('isThirdPartyRumNoise', () => {
  it('识别 Safari 拨测脚本栈帧 + Load failed', () => {
    const stack = [
      'TypeError: Load failed',
      '    at h (app:///rum_common.js:1:1997)',
      '    at app:///rum_common.js:1:10548',
    ].join('\n');
    expect(isThirdPartyRumNoise('Load failed (rumprbjs-sp.ialicdn.com)', stack)).toBe(true);
    expect(isThirdPartyRumNoise('TypeError: Load failed', stack)).toBe(true);
  });

  it('识别 Chromium/Firefox 的同类文案', () => {
    expect(
      isThirdPartyRumNoise('Failed to fetch', 'https://rjsprbi.myalicdn.com/rum_common.js'),
    ).toBe(true);
    expect(
      isThirdPartyRumNoise(
        'NetworkError when attempting to fetch resource.',
        'https://rumprbjs-sp.ialicdn.com/target1/test1.jpg',
      ),
    ).toBe(true);
  });

  it('仅有拨测 URL breadcrumb（栈被跨域裁掉）时也识别', () => {
    const haystack = ['https://rumprbjs-sp.ialicdn.com/target1/test1.jpg', 'https://rumprbjs-sp.ialicdn.com/target2/test2.jpg'].join('\n');
    expect(isThirdPartyRumNoise('Load failed', haystack)).toBe(true);
  });

  it('不误伤本站真实错误', () => {
    expect(isThirdPartyRumNoise(undefined, 'app:///rum_common.js')).toBe(false);
    expect(isThirdPartyRumNoise('Load failed', undefined)).toBe(false);
    expect(isThirdPartyRumNoise('Load failed', '')).toBe(false);
    // 缺少第三方指纹时，即便文案相同也保留
    expect(isThirdPartyRumNoise('Load failed', '    at fetchPage (/chunks/app.js:1:2)')).toBe(false);
    // 缺少网络失败文案时，不因栈里恰好出现第三方域名而吞掉
    expect(isThirdPartyRumNoise('Cannot read properties of null', 'app:///rum_common.js')).toBe(false);
    expect(isThirdPartyRumNoise('登录失败（500）', 'https://rumprbjs-sp.ialicdn.com/target1/test1.jpg')).toBe(false);
  });

  it('不误伤普通的 Failed to fetch', () => {
    expect(isThirdPartyRumNoise('Failed to fetch', '    at loadData (/chunks/main.js:9:9)')).toBe(false);
  });
});
