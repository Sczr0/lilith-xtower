import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { verifyCapToken, resetCapCircuitForTest } from '../withCap';

function stubFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(impl);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('verifyCapToken', () => {
  beforeEach(() => {
    resetCapCircuitForTest();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('未配置 CAP_SECRET_KEY（灰度模式）', () => {
    beforeEach(() => {
      vi.stubEnv('CAP_SECRET_KEY', '');
    });

    it('returns ok when token is empty (graceful degradation)', async () => {
      const fetchMock = stubFetch(async () => new Response('{}', { status: 200 }));
      const result = await verifyCapToken('');
      expect(result.ok).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns ok when token is undefined (graceful degradation)', async () => {
      const result = await verifyCapToken(undefined);
      expect(result.ok).toBe(true);
    });

    it('returns ok when token is null (graceful degradation)', async () => {
      const result = await verifyCapToken(null);
      expect(result.ok).toBe(true);
    });

    it('skips verification entirely even for non-empty tokens', async () => {
      const fetchMock = stubFetch(async () => new Response('{}', { status: 200 }));
      const result = await verifyCapToken('any-token');
      expect(result.ok).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('已配置 CAP_SECRET_KEY（强制校验）', () => {
    beforeEach(() => {
      vi.stubEnv('CAP_SECRET_KEY', 'test-secret');
    });

    it('rejects missing token as missing_token without calling siteverify', async () => {
      const fetchMock = stubFetch(async () => new Response('{}', { status: 200 }));

      for (const token of [undefined, null, ''] as const) {
        const result = await verifyCapToken(token);
        expect(result).toEqual({ ok: false, reason: 'missing_token' });
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects invalid token as invalid_token', async () => {
      stubFetch(async () => new Response(JSON.stringify({ success: false }), { status: 200 }));

      const result = await verifyCapToken('bad-token');
      expect(result).toEqual({ ok: false, reason: 'invalid_token' });
    });

    it('accepts a valid token', async () => {
      const fetchMock = stubFetch(
        async () => new Response(JSON.stringify({ success: true }), { status: 200 }),
      );

      const result = await verifyCapToken('good-token');
      expect(result).toEqual({ ok: true });

      const init = fetchMock.mock.calls[0]?.[1];
      expect(JSON.parse(String(init?.body))).toEqual({ secret: 'test-secret', response: 'good-token' });
    });

    it('degrades to ok via circuit breaker after repeated upstream failures (token present)', async () => {
      // 说明：网络层故障（fetch 抛错）对应 upstream_error；HTTP 4xx/5xx 在
      // withCap 现有语义下算 invalid_token。这里测的是「上游不可达」的降级路径。
      stubFetch(async () => {
        throw new Error('network down');
      });

      // 连续 5 次失败触发断路（CIRCUIT_FAILURE_THRESHOLD = 5）
      for (let i = 0; i < 5; i += 1) {
        const result = await verifyCapToken('token');
        expect(result).toEqual({ ok: false, reason: 'upstream_error' });
      }

      // 断路打开后：带 token 的请求降级放行
      const degraded = await verifyCapToken('token');
      expect(degraded).toEqual({ ok: true });
    });

    it('still rejects missing token while the circuit breaker is open', async () => {
      stubFetch(async () => {
        throw new Error('network down');
      });

      for (let i = 0; i < 5; i += 1) {
        await verifyCapToken('token');
      }

      // 断路打开也不能放过缺 token 的请求（缺 token 检查先于断路器）
      const result = await verifyCapToken(undefined);
      expect(result).toEqual({ ok: false, reason: 'missing_token' });
    });
  });
});
