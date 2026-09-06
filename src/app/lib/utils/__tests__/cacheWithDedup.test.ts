import { describe, it, expect, vi, afterEach } from 'vitest';

import { createDedupedCache } from '../cacheWithDedup';

afterEach(() => {
  vi.useRealTimers();
});

describe('createDedupedCache', () => {
  it('命中 TTL 内的缓存，fetcher 只执行一次', async () => {
    let calls = 0;
    const cache = createDedupedCache<number>({ ttlMs: 60_000 });

    const first = await cache.get('k', async () => ++calls);
    const second = await cache.get('k', async () => ++calls);

    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(calls).toBe(1);
  });

  it('TTL 过期后重新调用 fetcher', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const cache = createDedupedCache<number>({ ttlMs: 1_000 });

    await cache.get('k', async () => ++calls);
    vi.advanceTimersByTime(1_001);
    const next = await cache.get('k', async () => ++calls);

    expect(next).toBe(2);
    expect(calls).toBe(2);
  });

  it('并发调用共享同一个进行中请求（防击穿）', async () => {
    let calls = 0;
    const cache = createDedupedCache<number>({ ttlMs: 60_000 });

    const [a, b, c] = await Promise.all([
      cache.get('k', async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 42;
      }),
      cache.get('k', async () => {
        calls += 1;
        return 42;
      }),
      cache.get('k', async () => {
        calls += 1;
        return 42;
      }),
    ]);

    expect(a).toBe(42);
    expect(b).toBe(42);
    expect(c).toBe(42);
    expect(calls).toBe(1);
  });

  it('fetcher 失败后清除 dedup，允许下次重试', async () => {
    let calls = 0;
    const cache = createDedupedCache<number>({ ttlMs: 60_000 });

    await expect(
      cache.get('k', async () => {
        calls += 1;
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const retried = await cache.get('k', async () => ++calls);
    expect(retried).toBe(2);
  });

  it('maxSize：超过容量时按 LRU 淘汰（命中会刷新最近使用顺序）', async () => {
    const seq: number[] = [];
    const cache = createDedupedCache<number>({ ttlMs: 60_000, maxSize: 2 });
    const fetcher = (value: number): Promise<number> => {
      seq.push(value);
      return Promise.resolve(value);
    };

    await cache.get('a', () => fetcher(1)); // [a]
    await cache.get('b', () => fetcher(2)); // [a, b]
    await cache.get('a', () => fetcher(11)); // 命中并刷新 → LRU 顺序变为 [b, a]
    await cache.get('c', () => fetcher(3)); // 淘汰 b → [a, c]
    await cache.get('b', () => fetcher(22)); // b 已被淘汰，重新拉取 → 淘汰 a → [c, b]

    expect(seq).toEqual([1, 2, 3, 22]);

    // b 现已在缓存中，命中不再执行 fetcher
    const b = await cache.get('b', () => fetcher(222));
    expect(b).toBe(22);
    expect(seq).toEqual([1, 2, 3, 22]);
  });

  it('invalidate/clear 主动清除', async () => {
    let calls = 0;
    const cache = createDedupedCache<number>({ ttlMs: 60_000 });
    const fetcher = async (key: string) => {
      calls += 1;
      return key.length;
    };

    await cache.get('aa', () => fetcher('aa'));
    await cache.get('bb', () => fetcher('bb'));
    expect(calls).toBe(2);

    cache.invalidate('aa');
    await cache.get('aa', () => fetcher('aa')); // 重新拉取
    expect(calls).toBe(3);

    cache.clear();
    await cache.get('bb', () => fetcher('bb')); // 重新拉取
    expect(calls).toBe(4);
  });
});
