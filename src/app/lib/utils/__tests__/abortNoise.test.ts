import { describe, it, expect } from 'vitest';

import { isAbortNoise } from '../abortNoise';

describe('isAbortNoise', () => {
  it('识别 WebKit 的 Fetch is aborted（含带前缀的 toString）', () => {
    expect(isAbortNoise('Fetch is aborted')).toBe(true);
    expect(isAbortNoise('AbortError: Fetch is aborted')).toBe(true);
    expect(isAbortNoise('unhandledrejection: Fetch is aborted')).toBe(true);
  });

  it('识别 Chromium / undici 的通用 abort 文案', () => {
    expect(isAbortNoise('The operation was aborted.')).toBe(true);
    expect(isAbortNoise('The user aborted a request.')).toBe(true);
    expect(isAbortNoise('signal is aborted without reason')).toBe(true);
  });

  it('不误伤真实错误与超时错误', () => {
    expect(isAbortNoise(undefined)).toBe(false);
    expect(isAbortNoise(null)).toBe(false);
    expect(isAbortNoise('')).toBe(false);
    expect(isAbortNoise('登录失败（500）')).toBe(false);
    expect(isAbortNoise('Fetch failed')).toBe(false);
    expect(isAbortNoise('AbortError')).toBe(false);
    // TimeoutError 往往指向真实的服务端/网络问题，必须保留可观测性
    expect(isAbortNoise('TimeoutError: The operation timed out')).toBe(false);
  });
});
