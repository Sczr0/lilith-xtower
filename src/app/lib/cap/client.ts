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
 * - solve 状态可观测（solving / solved / failed），供登录流程决定是「等一会」
 *   还是「直接降级」，避免用户在 Cap 的 60s 解题窗口内被 403 拒绝
 * - 超时放弃时必定消费 solve() 的 rejection，避免 Cap 内部 60s 任务超时
 *   （[cap] rsw worker #0 timed out after 60000ms 等）以 unhandledrejection
 *   形式泄漏到 window，被 Sentry 全局 onunhandledrejection 误报
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

/** 后台解题状态：solving = 仍在算（可等待），solved/failed = 已有结论 */
export type CapSolveStatus = 'idle' | 'solving' | 'solved' | 'failed';

/** 解题结果：除 token 外额外区分「还没算完」与「已失败」，供调用方决定是否继续等待 */
export interface CapOutcome {
  token?: string;
  status: CapSolveStatus;
}

/** 已结算的解题结果（promise 解析值，永不 reject） */
interface CapSettlement {
  token?: string;
  ok: boolean;
  /** solve() 自身失败时的原始错误；等待预算耗尽时为 undefined */
  error?: unknown;
  /** 等待预算耗尽（solve 仍在后台计算） */
  timedOut?: boolean;
}

let capInstance: CapHandle | null = null;
let capTokenPromise: Promise<string | undefined> | null = null;
/** 结算 Promise：永不 reject，保证「放弃等待」时也不会留下未处理的 rejection */
let capOutcomePromise: Promise<CapSettlement> | null = null;
let capInitialized = false;

/** 当前解题状态（单例，供同步查询与 UI 提示） */
let capStatus: CapSolveStatus = 'idle';

/**
 * Solve 整体超时（超过此时间未拿到 token 即降级）。
 *
 * 注意：cap-widget 内部单任务硬超时为 60s（[cap] <label> timed out after 60000ms）。
 * 超时放弃时必须消费 solve() 的 rejection，否则 Cap 的 60s 任务超时可能以
 * unhandledrejection 形式泄漏到 window（Sentry: global_handlers.onunhandledrejection）。
 */
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
 * 竞速「后台解题」与「客户端等待预算」。
 *
 * 关键点：solvePromise 必须在 race 之外就被消费（settlement）。
 * 若只把它放进 Promise.race，一旦我们因超时先行放弃，Cap 内部 60s 任务超时
 * （rsw / sha256-pow worker）产生的 rejection 仍可能打到 window 上，被 Sentry
 * 全局 onunhandledrejection 记为未捕获异常。
 */
async function raceSolveWithTimeout(
  solvePromise: Promise<{ success: boolean; token: string }>,
  budgetMs: number,
): Promise<CapSettlement> {
  // settlement 永不 reject；同时充当 solvePromise 的消费点（吞掉迟到的 rejection）。
  // 注意：必须保留原始 error，否则上层无法按 error.code 判断是否可重试。
  const settlement: Promise<CapSettlement> = solvePromise.then(
    (value) => ({
      // 不直接用 value?.token：cap-widget 解析值可能与类型声明不一致
      token:
        typeof value?.token === 'string' && value.token.length > 0 ? value.token : undefined,
      ok: true,
    }),
    (error: unknown) => ({ token: undefined, ok: false, error }),
  );

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<CapSettlement>((resolve) => {
    timeoutHandle = setTimeout(
      () => resolve({ token: undefined, ok: false, timedOut: true }),
      Math.max(0, budgetMs),
    );
  });

  try {
    return await Promise.race([settlement, timeout]);
  } finally {
    // solve 先结束时清理定时器，避免留下悬挂的等待计时器
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
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
    capStatus = 'failed';
    return;
  }

  applyCapGlobals();
  capStatus = 'solving';

  capOutcomePromise = (async (): Promise<CapSettlement> => {
    // 冷却期检查：前一次失败时间太近则跳过本次 solve
    const sinceLastFail = Date.now() - lastSolveFailedAt;
    if (sinceLastFail < COOLDOWN_MS) {
      console.warn(
        `Cap: cooldown active (${Math.round((COOLDOWN_MS - sinceLastFail) / 1000)}s remaining), skipping solve`,
      );
      return { token: undefined, ok: false };
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
          const settlement = await raceSolveWithTimeout(
            capInstance.solve(),
            deadline - Date.now(),
          );

          if (settlement.ok) {
            lastSolveFailedAt = 0; // 成功清零冷却
            capStatus = 'solved';
            return settlement;
          }

          if (settlement.timedOut) {
            // 等待预算耗尽：solve 仍在后台计算，本轮按失败处理（实例会被摘下）
            throw new Error(
              `Cap solve timed out after ${Math.max(0, deadline - Date.now())}ms`,
            );
          }

          // solve 自身失败：抛出原始错误，保留 code 供重试判定
          throw settlement.error ?? new Error('Cap solve failed');
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
            capStatus = 'failed';
            console.warn(
              `Cap: solve failed after ${attempt + 1}/${MAX_SOLVE_ATTEMPTS} attempt(s), proceeding without CAPTCHA:`,
              error,
            );
            return { token: undefined, ok: false };
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
      capStatus = 'failed';
      console.warn('Cap: solve failed, proceeding without CAPTCHA:', error);
      return { token: undefined, ok: false };
    }

    // 预算耗尽或尝试耗尽：降级
    lastSolveFailedAt = Date.now();
    capStatus = 'failed';
    console.warn('Cap: solve failed, proceeding without CAPTCHA:', lastAttemptError);
    return { token: undefined, ok: false };
  })();

  capTokenPromise = capOutcomePromise.then((settlement) => settlement.token);
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
 * 获取解题结果（含「是否仍在解题」的状态）。
 *
 * - status = 'solved'：token 可用
 * - status = 'failed'：已确定本轮拿不到 token（失败/冷却/等待预算耗尽）
 * - status = 'solving'：仍在等待 Cap 的 60s 任务窗口，调用方可选择继续等或先降级
 *
 * 与 getCapToken() 共享同一个结算 Promise；解题未结束时调用会一直等待，
 * 因此「不愿等待」时应先用 getCapStatus() 判断。
 */
export async function getCapOutcome(): Promise<CapOutcome> {
  if (!capOutcomePromise) return { status: getCapStatus() };
  const settlement = await capOutcomePromise;
  return {
    token: settlement.token,
    status: settlement.ok && settlement.token ? 'solved' : 'failed',
  };
}

/**
 * 同步查询当前解题状态。
 * 'solving' 表示 Cap 内部仍在计算（其单任务硬超时为 60s），可继续等待。
 */
export function getCapStatus(): CapSolveStatus {
  return capStatus;
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
  capOutcomePromise = null;
  capInitialized = false;
  capStatus = 'idle';
  lastSolveFailedAt = 0;
}
