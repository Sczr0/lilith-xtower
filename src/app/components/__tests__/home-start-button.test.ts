import { describe, expect, it } from 'vitest';
import { getHomeStartHref } from '../HomeStartButton';

describe('getHomeStartHref', () => {
  it('认证通过时直达仪表盘', () => {
    expect(getHomeStartHref(true, false, false)).toBe('/dashboard');
  });

  it('认证状态加载中且本地缓存已登录时直达仪表盘', () => {
    expect(getHomeStartHref(false, true, true)).toBe('/dashboard');
  });

  it('认证状态加载中且无缓存时进入登录页', () => {
    expect(getHomeStartHref(false, false, true)).toBe('/login');
  });

  it('未认证时进入登录页（即使本地缓存已登录）', () => {
    expect(getHomeStartHref(false, true, false)).toBe('/login');
  });
});
