import { describe, it, expect } from 'vitest';

import { isInjectedScriptNoise } from '../injectedScriptNoise';

describe('isInjectedScriptNoise', () => {
  it('识别已知注入脚本指纹（不看栈）', () => {
    expect(isInjectedScriptNoise('LIDNotify is not defined', ['<anonymous>'])).toBe(true);
    expect(isInjectedScriptNoise('ReferenceError: LIDNotify is not defined', [])).toBe(true);
    expect(
      isInjectedScriptNoise('window.android.unLoad is not a function', [
        'app:///_next/static/chunks/3-4q_crxf4mdh.js',
        '<anonymous>',
      ]),
    ).toBe(true);
  });

  it('全局未定义/不是函数 且栈内没有任何非匿名帧时判为注入脚本', () => {
    expect(isInjectedScriptNoise('SomeGlobal is not defined', ['<anonymous>'])).toBe(true);
    expect(isInjectedScriptNoise('foo is not a function', [undefined, '<unknown>'])).toBe(true);
  });

  it('栈里出现本站打包帧时保留上报', () => {
    expect(
      isInjectedScriptNoise('SomeGlobal is not defined', [
        'app:///_next/static/chunks/main-app.js',
        '<anonymous>',
      ]),
    ).toBe(false);
    expect(
      isInjectedScriptNoise('foo is not a function', ['app:///_next/static/chunks/app/dashboard/page.js']),
    ).toBe(false);
  });

  it('其他类型错误一律保留', () => {
    expect(isInjectedScriptNoise('Cannot read properties of null', ['<anonymous>'])).toBe(false);
    expect(isInjectedScriptNoise(undefined, ['<anonymous>'])).toBe(false);
    expect(isInjectedScriptNoise('', ['<anonymous>'])).toBe(false);
  });

  it('缺少栈信息时保守放行（宁多报不吞）', () => {
    expect(isInjectedScriptNoise('SomeGlobal is not defined', [])).toBe(false);
  });
});
