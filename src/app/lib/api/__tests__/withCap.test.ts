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
      // 说明：网络层故障（fetch 抛错）与 HTTP 5xx 才是「上游自身故障」，计入熔断；
      // HTTP 4xx 与 success:false 属于验证失败，不计数也不降级。
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

    it('does not open the circuit on repeated invalid tokens (success:false)', async () => {
      const fetchMock = stubFetch(
        async () => new Response(JSON.stringify({ success: false }), { status: 200 }),
      );

      // 远超阈值的次数：每次都必须被拒绝，不得因熔断而放行
      for (let i = 0; i < 8; i += 1) {
        expect(await verifyCapToken('garbage-token')).toEqual({
          ok: false,
          reason: 'invalid_token',
        });
      }
      expect(fetchMock).toHaveBeenCalledTimes(8);
    });

    it('does not open the circuit on 4xx rejections from siteverify', async () => {
      const fetchMock = stubFetch(
        async () => new Response(JSON.stringify({ success: false }), { status: 403 }),
      );

      for (let i = 0; i < 8; i += 1) {
        expect(await verifyCapToken('garbage-token')).toEqual({
          ok: false,
          reason: 'invalid_token',
        });
      }
      expect(fetchMock).toHaveBeenCalledTimes(8);
    });

    it('counts 5xx toward the circuit breaker and degrades only after it opens', async () => {
      stubFetch(async () => new Response('upstream boom', { status: 503 }));

      // 前 5 次按上游故障返回（登录侧据此降级），第 6 次进入断路降级
      for (let i = 0; i < 5; i += 1) {
        expect(await verifyCapToken('token')).toEqual({ ok: false, reason: 'upstream_error' });
      }
      expect(await verifyCapToken('token')).toEqual({ ok: true });
    });

    it('closes the circuit once upstream answers again (recovered token still rejected)', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        stubFetch(async () => {
          throw new Error('network down');
        });
        for (let i = 0; i < 5; i += 1) {
          await verifyCapToken('token');
        }
        expect(await verifyCapToken('token')).toEqual({ ok: true }); // 断路期降级放行

        // 30s 后半开探测：上游已恢复，并明确拒绝该 token
        vi.setSystemTime(Date.now() + 31_000);
        stubFetch(async () => new Response(JSON.stringify({ success: false }), { status: 403 }));

        expect(await verifyCapToken('token')).toEqual({ ok: false, reason: 'invalid_token' });
        // 断路器已重置：后续无效 token 不再被降级放行
        expect(await verifyCapToken('token')).toEqual({ ok: false, reason: 'invalid_token' });
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
