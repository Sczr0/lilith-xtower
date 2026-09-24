import 'server-only';

/**
 * 进程内并发闸（信号量）：限制同时在途的上游请求数，超出的排队等待而非直接失败。
 *
 * 用途：/api/image/bn 与 /api/image/song 把图片渲染委托给上游，此前没有任何并发上限，
 * 突发请求会同时打满上游（2H2G 源站与上游渲染进程都吃不消）。
 *
 * 实现要点：名额在 release 时**直接移交**给等待者，而不是先自减再让等待者自增。
 * 后者存在竞态——释放瞬间若有新调用抢先占用名额，等待者唤醒后又自增，会突破上限。
 */
export function createSemaphore(maxConcurrent: number) {
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
    throw new Error('maxConcurrent must be a positive integer');
  }

  let active = 0;
  const waiters: Array<() => void> = [];

  async function acquire(): Promise<void> {
    if (active < maxConcurrent) {
      active += 1;
      return;
    }
    await new Promise<void>((resolve) => waiters.push(resolve));
    // 名额已由 release 移交，此处不再自增
  }

  function release(): void {
    const next = waiters.shift();
    if (next) {
      next();
      return;
    }
    active -= 1;
  }

  /** 在闸门内执行任务：无论成功或抛错都会释放名额。 */
  async function run<T>(task: () => Promise<T>): Promise<T> {
    await acquire();
    try {
      return await task();
    } finally {
      release();
    }
  }

  return { run };
}
