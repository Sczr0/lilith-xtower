import { vi } from 'vitest';

/**
 * 让 undici 自带的 fetch 在测试中转发到 globalThis.fetch。
 *
 * upstreamFetch 现在用 undici 的 fetch + 跨洋专用 keep-alive Agent
 * （见 src/app/lib/api/upstreamFetch.ts）。而项目既有路由测试统一通过替换
 * globalThis.fetch 来拦截上游请求；此 shim 把两条路径统一，避免为每个
 * 断言上游请求体的用例单独 mock undici。
 */
vi.mock('undici', async (importOriginal) => {
  const actual = await importOriginal<typeof import('undici')>();
  return {
    ...actual,
    fetch: (...args: Parameters<typeof fetch>) => (globalThis.fetch as typeof fetch)(...args),
  };
});
