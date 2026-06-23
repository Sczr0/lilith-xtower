import { describe, expect, it, beforeAll } from 'vitest';

import { verifyCapToken, resetCapCircuitForTest } from '../api/withCap';

describe('verifyCapToken', () => {
  beforeAll(() => {
    // 确保在干净状态下测试
    resetCapCircuitForTest();
  });

  it('returns ok when token is empty (graceful degradation)', async () => {
    const result = await verifyCapToken('');
    expect(result.ok).toBe(true);
  });

  it('returns ok when token is undefined (graceful degradation)', async () => {
    const result = await verifyCapToken(undefined);
    expect(result.ok).toBe(true);
  });

  it('returns ok when token is null (graceful degradation)', async () => {
    const result = await verifyCapToken(null);
    expect(result.ok).toBe(true);
  });
});
