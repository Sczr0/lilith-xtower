/**
 * Cap 验证码客户端 — 程序化模式（无可见组件）
 *
 * 设计：
 * - 页面加载时自动在后台启动解题（new Cap → solve）
 * - PoW 2-4 秒内完成，用户在扫码/填写表单期间无感
 * - 获取 token 失败 → 返回 undefined（渐进式降级）
 * - 模块级单例，整个登录页生命周期共享一个 instance
 * - 内置超时 & 防重试风暴，避免 instr_timeout 级联触发服务器 429
 *
 * Note: cap-widget 的运行时 Cap 类没有绑定 removeEventListener（与 .d.ts 类型声明不一致），
 * 因此事件清理通过 widget DOM 元素进行。
 */

/** 运行时 Cap 实例的最小类型描述（cap-widget .d.ts 与实际运行时不一致） */
interface CapHandle {
  token: string | null;
  solve(): Promise<{ success: boolean; token: string }>;
  widget: HTMLElement & {
    addEventListener(type: string, handler: EventListenerOrEventListenerObject): void;
    removeEventListener(type: string, handler: EventListenerOrEventListenerObject): void;
  };
}

let capInstance: CapHandle | null = null;
let capTokenPromise: Promise<string | undefined> | null = null;
let capInitialized = false;

/** Solve 整体超时（超过此时间未拿到 token 即降级） */
const SOLVE_TIMEOUT_MS = 12_000;

/** 连续失败冷却期（避免短时间内反复调用 solve 触发服务器限流） */
const COOLDOWN_MS = 30_000;
let lastSolveFailedAt = 0;

/**
 * 在 window 上设置 Cap 全局选项（在 new Cap() 之前调用）
 */
function applyCapGlobals(): void {
  // 生产环境下静音 Cap 内部日志，避免 instr_timeout 等错误信息刷屏
  if (process.env.NODE_ENV === 'production') {
    (window as any).CAP_SILENT = true;
  }
}

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

  applyCapGlobals();

  capTokenPromise = (async () => {
    // 冷却期检查：前一次失败时间太近则跳过本次 solve
    const sinceLastFail = Date.now() - lastSolveFailedAt;
    if (sinceLastFail < COOLDOWN_MS) {
      console.warn(
        `Cap: cooldown active (${Math.round((COOLDOWN_MS - sinceLastFail) / 1000)}s remaining), skipping solve`,
      );
      return undefined;
    }

    try {
      const { default: Cap } = await import('cap-widget');
      capInstance = new Cap({ apiEndpoint }) as unknown as CapHandle;

      // 通过 widget (HTMLElement) 监听 error 事件，提取错误码用于诊断
      const errorHandler = (event: Event) => {
        const ce = event as CustomEvent<{ isCap?: boolean; code?: string; message?: string }>;
        const detail = ce.detail;
        if (detail?.isCap) {
          console.warn(`Cap: server returned error [${detail.code}]: ${detail.message}`);
          // 标记失败时间，防止短时间内重试触发 429
          lastSolveFailedAt = Date.now();
        }
      };
      capInstance.widget.addEventListener('error', errorHandler);

      // 带超时的 solve：避免卡住 20s+ 的 instr_timeout
      const solution = await Promise.race([
        capInstance.solve(),
        new Promise<{ success: false; token: '' }>((_, reject) =>
          setTimeout(() => {
            lastSolveFailedAt = Date.now();
            reject(new Error(`Cap solve timed out after ${SOLVE_TIMEOUT_MS}ms`));
          }, SOLVE_TIMEOUT_MS),
        ),
      ]).finally(() => {
        // cap-widget 的 Cap 类没有绑定 removeEventListener，通过 widget 清理
        capInstance?.widget.removeEventListener('error', errorHandler);
      });

      return solution?.token ?? undefined;
    } catch (error) {
      lastSolveFailedAt = Date.now();
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
 * 强制重置 Cap 冷却状态（测试/管理用）
 */
export function resetCapCooldown(): void {
  lastSolveFailedAt = 0;
}

/**
 * 重置 Cap 状态（测试用）
 */
export function resetCapClient(): void {
  capInstance = null;
  capTokenPromise = null;
  capInitialized = false;
  lastSolveFailedAt = 0;
}
