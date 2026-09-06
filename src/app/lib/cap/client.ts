/**
 * Cap 验证码客户端 — 程序化模式（无可见组件）
 *
 * 设计：
 * - 页面加载时自动在后台启动解题（new Cap → solve）
 * - PoW 2-4 秒内完成，用户在扫码/填写表单期间无感
 * - 获取 token 失败 → 返回 undefined（渐进式降级）
 * - 模块级单例，整个登录页生命周期共享一个 instance
 * - 内置超时 & 防重试风暴，避免 instr_timeout 级联触发服务器 429
 * - 瞬时故障（challenge_parse_error / network_error 等，多为 CDN/WAF 抖动或
 *   服务端瞬时错误）自动重试一次，避免抖动直接演变成「安全验证未完成」403
 *
 * Note: cap-widget 的运行时 Cap 类没有绑定 removeEventListener（与 .d.ts 类型声明不一致），
 * 因此事件清理通过 widget DOM 元素进行。
 *
 * Note: cap-widget 内部以 bubbles + composed 分发 `error` 事件；若放任其冒泡到
 * window，会被 Sentry 全局 onerror 处理器当作「未处理异常」捕获上报（例如
 * challenge_parse_error 会产生 `Event \`CustomEvent\` (type=error) captured as exception`）。
 * 这些错误在业务上已被显式处理（降级/重试），并非未捕获异常，因此统一在 widget
 * 层监听并 stopPropagation 截断冒泡，仅保留诊断日志。
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

/** cap-widget 默认导出的 Cap 类（仅用于构造，不依赖其静态类型声明） */
type CapCtor = new (config: { apiEndpoint: string }) => CapHandle;

/** Cap 错误事件 detail 的结构（cap-widget dispatchEvent 的 detail 字段） */
interface CapErrorDetail {
  isCap?: boolean;
  code?: string;
  message?: string;
}

let capInstance: CapHandle | null = null;
let capTokenPromise: Promise<string | undefined> | null = null;
let capInitialized = false;

/** Solve 整体超时（超过此时间未拿到 token 即降级） */
const SOLVE_TIMEOUT_MS = 12_000;

/** 连续失败冷却期（避免短时间内反复调用 solve 触发服务器限流） */
const COOLDOWN_MS = 30_000;
let lastSolveFailedAt = 0;

/** 总尝试次数（首次 + 最多 1 次重试） */
const MAX_SOLVE_ATTEMPTS = 2;

/** 重试前等待（避开瞬时抖动窗口，同时给 CDN/WAF 一次回退机会） */
const RETRY_DELAY_MS = 1_000;

/**
 * 可安全重试的瞬时错误码：
 * - challenge_parse_error：/challenge 响应非 JSON（服务器/CDN 瞬时错误）
 * - network_error / redeem_failed / solve_failed：服务端瞬时故障或响应抖动
 * 注：instr_blocked / instr_timeout 是环境检测结论，重试只会复现，不在此列。
 */
const TRANSIENT_ERROR_CODES = new Set<string>([
  'challenge_parse_error',
  'network_error',
  'redeem_failed',
  'solve_failed',
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 在 window 上设置 Cap 全局选项（在 new Cap() 之前调用）
 */
function applyCapGlobals(): void {
  // 生产环境下静音 Cap 内部日志，避免 instr_timeout 等错误信息刷屏
  if (process.env.NODE_ENV === 'production') {
    (window as unknown as { CAP_SILENT?: boolean }).CAP_SILENT = true;
  }
}

/**
 * 创建 cap-widget 实例，并注册 error 事件监听。
 *
 * 监听器除了记录诊断日志外，还会调用 stopPropagation() 截断冒泡：
 * cap-widget 的 error 事件是 bubbles + composed 的 CustomEvent，若不截断，
 * 事件会一路冒泡到 window，被 Sentry 全局 onerror 误报为未处理异常
 * （Handled: No, mechanism: auto.browser.global_handlers.onerror）。
 * 注意 stopPropagation 只影响冒泡到祖先节点，不会影响 widget 自身绑定的
 * 内部事件监听（boundHandleError 等）。
 */
function createCapWidget(CapCtor: CapCtor, apiEndpoint: string): CapHandle {
  const instance = new CapCtor({ apiEndpoint }) as unknown as CapHandle;

  instance.widget.addEventListener('error', (event: Event) => {
    event.stopPropagation();
    const detail = (event as CustomEvent<CapErrorDetail>).detail;
    if (detail?.isCap) {
      console.warn(`Cap: server returned error [${detail.code}]: ${detail.message}`);
    }
  });

  return instance;
}

/** 摘下 widget DOM 元素触发 disconnectedCallback，让 cap-widget 内部清理（abort/线程池等） */
function disposeCapWidget(instance: CapHandle | null): void {
  instance?.widget.remove();
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

    const deadline = Date.now() + SOLVE_TIMEOUT_MS;
    let lastAttemptError: unknown = null;

    try {
      const { default: Cap } = await import('cap-widget');
      const CapCtor = Cap as unknown as CapCtor;

      for (let attempt = 0; attempt < MAX_SOLVE_ATTEMPTS; attempt++) {
        if (attempt > 0) {
          // 重试前稍作等待，避开瞬时抖动；超时前放弃
          const wait = Math.min(RETRY_DELAY_MS, Math.max(0, deadline - Date.now()));
          if (wait <= 0) break;
          await sleep(wait);
        }

        try {
          capInstance = createCapWidget(CapCtor, apiEndpoint);

          // 带超时的 solve：整体预算内完成，避免卡住 20s+ 的 instr_timeout
          const solution = await Promise.race([
            capInstance.solve(),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error(`Cap solve timed out after ${Math.max(0, deadline - Date.now())}ms`)),
                Math.max(0, deadline - Date.now()),
              ),
            ),
          ]);

          lastSolveFailedAt = 0; // 成功清零冷却
          return typeof solution?.token === 'string' && solution.token.length > 0
            ? solution.token
            : undefined;
        } catch (error) {
          lastAttemptError = error;
          // 摘下失败的实例（内部会 abort 未完成的工作），下一次尝试重建全新实例
          disposeCapWidget(capInstance);
          capInstance = null;

          const code =
            typeof error === 'object' && error !== null
              ? (error as { code?: unknown }).code
              : undefined;
          const isTransient = typeof code === 'string' && TRANSIENT_ERROR_CODES.has(code);
          const isLastAttempt = attempt >= MAX_SOLVE_ATTEMPTS - 1;

          if (!isTransient || isLastAttempt) {
            lastSolveFailedAt = Date.now();
            console.warn(
              `Cap: solve failed after ${attempt + 1}/${MAX_SOLVE_ATTEMPTS} attempt(s), proceeding without CAPTCHA:`,
              error,
            );
            return undefined;
          }

          console.warn(
            `Cap: transient error [${String(code)}], retrying (attempt ${attempt + 2}/${MAX_SOLVE_ATTEMPTS})…`,
          );
        }
      }
    } catch (error) {
      // import 失败等绕过尝试循环的错误
      lastAttemptError = error;
      lastSolveFailedAt = Date.now();
      console.warn('Cap: solve failed, proceeding without CAPTCHA:', error);
      return undefined;
    }

    // 预算耗尽或尝试耗尽：降级
    lastSolveFailedAt = Date.now();
    console.warn('Cap: solve failed, proceeding without CAPTCHA:', lastAttemptError);
    return undefined;
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
  disposeCapWidget(capInstance);
  capInstance = null;
  capTokenPromise = null;
  capInitialized = false;
  lastSolveFailedAt = 0;
}
