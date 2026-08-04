// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthStorage } from '../auth';
import { LOGIN_CACHED_KEY } from '../../constants/storageKeys';

describe('AuthStorage 登录缓存', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('未写入时默认未登录', () => {
    expect(AuthStorage.getCachedLogin()).toBe(false);
  });

  it('写入 true 后可以读取', () => {
    AuthStorage.setCachedLogin(true);
    expect(AuthStorage.getCachedLogin()).toBe(true);
  });

  it('写入 false 后读取为未登录', () => {
    AuthStorage.setCachedLogin(true);
    AuthStorage.setCachedLogin(false);
    expect(AuthStorage.getCachedLogin()).toBe(false);
  });

  it('清除后恢复未登录', () => {
    AuthStorage.setCachedLogin(true);
    AuthStorage.clearCachedLogin();
    expect(AuthStorage.getCachedLogin()).toBe(false);
  });

  it('使用 LOGIN_CACHED_KEY 作为存储键', () => {
    AuthStorage.setCachedLogin(true);
    expect(localStorage.getItem(LOGIN_CACHED_KEY)).toBe('1');
  });
});
