/**
 * 带防击穿的缓存包装器
 *
 * - TTL 自动过期
 * - 缓存失效时，对同一 key 的并发调用共享同一个 Promise（防击穿）
 * - 请求失败后自动清除 dedup，允许后续调用重试
 * - 可选 maxSize：LRU 淘汰，防止高基数 key（如用户输入的搜索词）无限增长
 */
export function createDedupedCache<T>(config: {
  ttlMs: number;
  maxSize?: number;
  onError?: (err: unknown) => void;
}) {
  const valueCache = new Map<string, { data: T; ts: number }>();
  const pendingCache = new Map<string, Promise<T>>();

  /** 命中时重插以刷新 LRU 顺序（仅配置 maxSize 时有意义） */
  const touch = (key: string) => {
    if (!config.maxSize) return;
    const entry = valueCache.get(key);
    if (entry === undefined) return;
    valueCache.delete(key);
    valueCache.set(key, entry);
  };

  /** 容量满时淘汰最久未使用的条目（Map 迭代顺序的第一个） */
  const evictOldest = () => {
    if (!config.maxSize) return;
    while (valueCache.size >= config.maxSize) {
      const firstKey = valueCache.keys().next().value;
      if (firstKey === undefined) break;
      valueCache.delete(firstKey);
    }
  };

  return {
    /**
     * 通过 key 获取数据，命中缓存直接返回，否则调用 fetcher 并防并发重复
     */
    async get(key: string, fetcher: () => Promise<T>): Promise<T> {
      // 1. 有效缓存命中
      const valueEntry = valueCache.get(key);
      if (valueEntry && Date.now() - valueEntry.ts < config.ttlMs) {
        touch(key);
        return valueEntry.data;
      }

      // 2. 已有相同 key 的进行中请求 → 共享 promise（防击穿核心）
      const pending = pendingCache.get(key);
      if (pending) {
        try {
          return await pending;
        } catch {
          // 共享的 promise 失败，清除后递归重试
          pendingCache.delete(key);
          return this.get(key, fetcher);
        }
      }

      // 3. 发起新请求
      const promise = fetcher()
        .then((data) => {
          evictOldest();
          valueCache.set(key, { data, ts: Date.now() });
          return data;
        })
        .catch((err) => {
          config.onError?.(err);
          throw err;
        })
        .finally(() => {
          pendingCache.delete(key);
        });

      pendingCache.set(key, promise);
      return promise;
    },

    /** 主动清除指定 key */
    invalidate(key: string): void {
      valueCache.delete(key);
    },

    /** 清除所有缓存（不中断正在进行的请求） */
    clear(): void {
      valueCache.clear();
    },
  };
}
