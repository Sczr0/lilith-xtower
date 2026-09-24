import { describe, it, expect } from 'vitest';

import { isBrowserNetworkFailureNoise } from '../browserNetworkNoise';

describe('isBrowserNetworkFailureNoise', () => {
  it('识别 Safari/WebKit 的 Load failed（含线上实测文案）', () => {
    expect(isBrowserNetworkFailureNoise('Load failed (lilith.xtower.site)')).toBe(true);
    expect(isBrowserNetworkFailureNoise('Load failed')).toBe(true);
    expect(isBrowserNetworkFailureNoise('TypeError: Load failed')).toBe(true);
    expect(isBrowserNetworkFailureNoise('  Load failed  ')).toBe(true);
  });

  it('识别 Chromium / Firefox 的同类文案', () => {
    expect(isBrowserNetworkFailureNoise('Failed to fetch')).toBe(true);
    expect(isBrowserNetworkFailureNoise('TypeError: Failed to fetch')).toBe(true);
    expect(isBrowserNetworkFailureNoise('NetworkError when attempting to fetch resource.')).toBe(true);
  });

  it('不误伤本站自己抛出的错误', () => {
    // svgRenderer 的字体预加载失败，带业务前缀
    expect(isBrowserNetworkFailureNoise('Failed to fetch font: 404 https://example.com/a.woff')).toBe(false);
    // 预取失败
    expect(isBrowserNetworkFailureNoise('Failed to prefetch RKS data')).toBe(false);
    // 业务文案
    expect(isBrowserNetworkFailureNoise('加载失败，请检查网络后重试。')).toBe(false);
    expect(isBrowserNetworkFailureNoise('Load failed to parse config')).toBe(false);
    expect(isBrowserNetworkFailureNoise('Failed to fetch：超时')).toBe(false);
  });

  it('空值不匹配', () => {
    expect(isBrowserNetworkFailureNoise(undefined)).toBe(false);
    expect(isBrowserNetworkFailureNoise(null)).toBe(false);
    expect(isBrowserNetworkFailureNoise('')).toBe(false);
  });
});
