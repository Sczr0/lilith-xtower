import { describe, expect, it } from 'vitest';

import { createSemaphore } from '../upstreamSemaphore';

describe('createSemaphore', () => {
  it('rejects invalid maxConcurrent', () => {
    expect(() => createSemaphore(0)).toThrow();
    expect(() => createSemaphore(-1)).toThrow();
    expect(() => createSemaphore(1.5)).toThrow();
  });

  it('never exceeds maxConcurrent in-flight tasks', async () => {
    const gate = createSemaphore(2);
    let active = 0;
    let peak = 0;

    const makeTask = () => async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return 'ok';
    };

    await Promise.all(Array.from({ length: 8 }, () => gate.run(makeTask())));
    expect(peak).toBe(2);
    expect(active).toBe(0);
  });

  it('releases the slot when the task throws', async () => {
    const gate = createSemaphore(1);

    await expect(
      gate.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    // 名额已释放：后续任务不应被永久阻塞
    await expect(gate.run(async () => 'after')).resolves.toBe('after');
  });

  it('runs queued tasks in FIFO order after release', async () => {
    const gate = createSemaphore(1);
    const order: number[] = [];

    await Promise.all(
      [0, 1, 2, 3].map((index) =>
        gate.run(async () => {
          await new Promise((resolve) => setTimeout(resolve, 2));
          order.push(index);
        }),
      ),
    );

    expect(order).toEqual([0, 1, 2, 3]);
  });
});
