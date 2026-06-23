/**
 * Cap 验证码客户端 — 程序化模式（无可见组件）
 *
 * 设计：
 * - 页面加载时自动在后台启动解题（new Cap → solve）
 * - PoW 2-4 秒内完成，用户在扫码/填写表单期间无感
 * - 获取 token 失败 → 返回 undefined（渐进式降级）
 * - 模块级单例，整个登录页生命周期共享一个 instance
 */

let capInstance: import('cap-widget').default | null = null;
let capTokenPromise: Promise<string | undefined> | null = null;
let capInitialized = false;

/**
 * 启动 Cap 后台解题（幂等，多次调用只初始化一次）
 *
 * @param apiEndpoint Cap Standalone 的 site key URL，如 "https://cap.xtower.site/904b5b0099/"
 */
export function initCap(apiEndpoint: string): void {
  if (capInitialized) return;
  capInitialized = true;

  if (!apiEndpoint) {
    console.warn('Cap: no apiEndpoint configured, CAPTCHA disabled');
    return;
  }

  capTokenPromise = (async () => {
    try {
      const Cap = (await import('cap-widget')).default;
      capInstance = new Cap({ apiEndpoint });
      const solution = await capInstance.solve();
      return solution?.token ?? undefined;
    } catch (error) {
      console.warn('Cap: solve failed, proceeding without CAPTCHA:', error);
      return undefined;
    }
  })();
}

/**
 * 获取已完成解题的 Cap token。
 * - 如果 initCap 未调用 → undefined
 * - 如果解题还未完成 → await 等待
 * - 如果解题失败 → undefined
 */
export async function getCapToken(): Promise<string | undefined> {
  if (!capTokenPromise) return undefined;
  try {
    return await capTokenPromise;
  } catch {
    return undefined;
  }
}

/**
 * 同步获取 token（如果已就绪），否则返回 undefined。
 * 优先使用异步 getCapToken()。
 */
export function getCapTokenSync(): string | undefined {
  return capInstance?.token ?? undefined;
}

/**
 * 重置 Cap 状态（测试用）
 */
export function resetCapClient(): void {
  capInstance = null;
  capTokenPromise = null;
  capInitialized = false;
}
