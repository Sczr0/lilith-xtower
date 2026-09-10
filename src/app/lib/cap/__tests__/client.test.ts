// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCapOutcome, getCapStatus, getCapToken, initCap, resetCapClient } from '../client';

const CAP_ENDPOINT = 'https://cap.xtower.site/58ea82a280/';

/** cap-widget 的模拟实现（与真实 Cap 类行为对齐：widget 挂到 documentElement 上） */
const { FakeCap, capInstances, setSolveImpl } = vi.hoisted(() => {
  const capInstances: Array<{
    widget: HTMLElement;
    token: string | null;
    solve: ReturnType<typeof vi.fn>;
  }> = [];

  let solveImpl: () => Promise<{ success: boolean; token: string }> = async () => ({
    success: true,
    token: 'default-token',
  });

  class FakeCap {
    widget: HTMLElement;
    token: string | null = null;
    solve: ReturnType<typeof vi.fn>;

    constructor(config: { apiEndpoint: string }) {
      void config;
      this.widget = document.createElement('div');
      this.widget.style.display = 'none';
      document.documentElement.appendChild(this.widget);
      this.solve = vi.fn(() => solveImpl());
      capInstances.push(this);
    }
  }

  return {
    FakeCap,
    capInstances,
    setSolveImpl(fn: () => Promise<{ success: boolean; token: string }>) {
      solveImpl = fn;
    },
  };
});

vi.mock('cap-widget', () => ({ default: FakeCap }));

function flushMicrotasks(): Promise<void> {
  // 动态 import + 多级 promise 链需要若干轮微任务才能稳定推进。
  // 注意：不能依赖 setImmediate/setTimeout（fake timers 下会被接管）。
  return (async () => {
    for (let i = 0; i < 16; i++) {
      await Promise.resolve();
    }
  })();
}

function dispatchCapError(widget: HTMLElement, code: string, message: string): void {
  widget.dispatchEvent(
    new CustomEvent('error', {
      bubbles: true,
      composed: true,
      detail: { isCap: true, code, message },
    }),
  );
}

describe('cap client（程序化模式）', () => {
  beforeEach(() => {
    resetCapClient();
    capInstances.length = 0;
    setSolveImpl(async () => ({ success: true, token: 'default-token' }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('正常解题成功时返回 token', async () => {
    setSolveImpl(async () => ({ success: true, token: 'good-token' }));

    initCap(CAP_ENDPOINT);

    expect(await getCapToken()).toBe('good-token');
    expect(capInstances).toHaveLength(1);
    expect(capInstances[0]!.solve).toHaveBeenCalledTimes(1);
  });

  it('error CustomEvent 在 widget 层被截断，不会冒泡到 window（Sentry 全局 onerror 不受影响）', async () => {
    // Simulate cap-widget: on solve failure it dispatches a bubbling `error`
    // CustomEvent with { isCap: true, code } before rejecting the promise.
    setSolveImpl(async () => {
      const widget = capInstances[0]!.widget;
      dispatchCapError(widget, 'challenge_parse_error', 'Failed to parse challenge response from server');
      throw Object.assign(new Error('Failed to parse challenge response from server'), {
        code: 'challenge_parse_error',
      });
    });

    const windowErrorSpy = vi.fn();
    window.addEventListener('error', windowErrorSpy);

    initCap(CAP_ENDPOINT);
    await flushMicrotasks();

    // 事件被 stopPropagation 截断：window 的 error 监听从未触发
    expect(windowErrorSpy).not.toHaveBeenCalled();
    // 但诊断日志仍然保留
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Cap: server returned error [challenge_parse_error]'),
    );
  });

  it('瞬时错误（challenge_parse_error）自动重试一次并拿到 token', async () => {
    let attempts = 0;
    setSolveImpl(async () => {
      attempts += 1;
      if (attempts === 1) {
        const widget = capInstances[0]!.widget;
        dispatchCapError(widget, 'challenge_parse_error', 'Failed to parse challenge response from server');
        throw Object.assign(new Error('Failed to parse challenge response from server'), {
          code: 'challenge_parse_error',
        });
      }
      return { success: true, token: 'retry-token' };
    });

    const windowErrorSpy = vi.fn();
    window.addEventListener('error', windowErrorSpy);

    vi.useFakeTimers();
    initCap(CAP_ENDPOINT);
    await flushMicrotasks();

    expect(capInstances).toHaveLength(1);
    expect(attempts).toBe(1);

    // 推进 1s 重试等待
    await vi.advanceTimersByTimeAsync(1_000);
    await flushMicrotasks();

    expect(capInstances).toHaveLength(2); // 旧实例被摘下，重建了全新实例
    expect(await getCapToken()).toBe('retry-token');
    expect(windowErrorSpy).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('transient error [challenge_parse_error]'),
    );
  });

  it('非瞬时错误不重试，直接降级（无 token）', async () => {
    setSolveImpl(async () => {
      const widget = capInstances[0]!.widget;
      dispatchCapError(widget, 'invalid_solution', 'Invalid solution');
      throw Object.assign(new Error('Invalid solution'), { code: 'invalid_solution' });
    });

    initCap(CAP_ENDPOINT);
    await flushMicrotasks();

    expect(await getCapToken()).toBeUndefined();
    expect(capInstances).toHaveLength(1); // 未重试
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('solve failed after 1/2'),
      expect.anything(),
    );
  });

  it('solve 迟迟不返回时，等待预算耗尽即降级，且不会把 solve 的 rejection 泄漏到 window', async () => {
    // 关键回归：cap-widget 内部单任务硬超时为 60s（[cap] rsw worker #0 timed out after 60000ms）。
    // 若我们在 12s 放弃时没有消费 solve() 的 rejection，Cap 的 60s 任务超时就会以
    // unhandledrejection 形式泄漏到 window，被 Sentry 全局 onunhandledrejection 误报。
    let rejectSolve: ((error: unknown) => void) | undefined;
    setSolveImpl(
      () =>
        new Promise((_resolve, reject) => {
          rejectSolve = reject;
        }),
    );

    vi.useFakeTimers();
    initCap(CAP_ENDPOINT);
    await flushMicrotasks();

    expect(getCapStatus()).toBe('solving');

    // 等待预算（12s）耗尽：客户端放弃等待
    await vi.advanceTimersByTimeAsync(12_000);
    await flushMicrotasks();

    expect(await getCapToken()).toBeUndefined();
    expect(getCapStatus()).toBe('failed');

    // 此后 Cap 内部 60s 任务超时才真正 reject：该 rejection 必须已被消费
    rejectSolve?.(new Error('[cap] rsw worker #0 timed out after 60000ms'));
    await flushMicrotasks();
  });

  it('solve 自身失败时保留原始错误（供按 code 判定是否重试）', async () => {
    setSolveImpl(async () => {
      throw Object.assign(new Error('[cap] rsw worker #0 timed out after 60000ms'), {
        code: 'solve_failed',
      });
    });

    initCap(CAP_ENDPOINT);
    await flushMicrotasks();

    expect(await getCapToken()).toBeUndefined();
    // 瞬时错误会先重试一次；重试用尽后降级
    expect(capInstances.length).toBeGreaterThanOrEqual(2);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('transient error [solve_failed]'),
    );
  });

  it('getCapOutcome 暴露解题状态：成功返回 token，失败返回 failed', async () => {
    setSolveImpl(async () => ({ success: true, token: 'outcome-token' }));

    initCap(CAP_ENDPOINT);

    expect(await getCapOutcome()).toEqual({ token: 'outcome-token', status: 'solved' });
    expect(getCapStatus()).toBe('solved');
  });

  it('getCapOutcome 在解题失败时返回 failed，未调用 initCap 时为 idle', async () => {
    setSolveImpl(async () => {
      throw Object.assign(new Error('Invalid solution'), { code: 'invalid_solution' });
    });

    initCap(CAP_ENDPOINT);
    await flushMicrotasks();

    expect(await getCapOutcome()).toEqual({ token: undefined, status: 'failed' });

    resetCapClient();
    expect(await getCapOutcome()).toEqual({ status: 'idle' });
  });
});
