/**
 * 带版本号 + TTL 的 localStorage 缓存封装
 *
 * 写入格式：{ v: number, d: T, ts: number }
 * - v: 版本号，不匹配时自动丢弃
 * - d: 数据本体
 * - ts: 写入时间戳，用于 TTL 判断
 */
export type ClientCacheEntry<T> = {
  v: number;
  d: T;
  ts: number;
};

export interface ClientCacheConfig<T> {
  key: string;
  version: number;
  ttlMs: number;
  /** 可选的结构校验，返回 null 时丢弃缓存 */
  sanitize?: (raw: unknown) => T | null;
}

export function createClientCache<T>(config: ClientCacheConfig<T>) {
  return {
    get(): T | null {
      try {
        const raw = localStorage.getItem(config.key);
        if (!raw) return null;

        const entry: ClientCacheEntry<unknown> = JSON.parse(raw);

        // 版本不匹配 → 丢弃
        if (
          typeof entry !== 'object' ||
          entry === null ||
          entry.v !== config.version
        ) {
          localStorage.removeItem(config.key);
          return null;
        }

        // TTL 过期 → 丢弃
        if (typeof entry.ts !== 'number' || Date.now() - entry.ts > config.ttlMs) {
          localStorage.removeItem(config.key);
          return null;
        }

        // 结构校验
        if (config.sanitize) {
          const sanitized = config.sanitize(entry.d);
          if (sanitized === null) {
            localStorage.removeItem(config.key);
            return null;
          }
          return sanitized;
        }

        return entry.d as T;
      } catch {
        localStorage.removeItem(config.key);
        return null;
      }
    },

    set(data: T): void {
      try {
        const entry: ClientCacheEntry<T> = {
          v: config.version,
          d: data,
          ts: Date.now(),
        };
        localStorage.setItem(config.key, JSON.stringify(entry));
      } catch {
        // localStorage 满或私密模式被拒绝
        console.warn(`[clientCache] Failed to write ${config.key}`);
      }
    },

    remove(): void {
      localStorage.removeItem(config.key);
    },
  };
}

/**
 * 带 ownerKey 隔离的多用户 localStorage 缓存
 *
 * 外层存储格式：Record<ownerKey, ClientCacheEntry<T>>
 * 每个 ownerKey 对应一个带版本号 + TTL 的独立条目
 */
export function createOwnerKeyCache<T>(config: {
  key: string;
  version: number;
  ttlMs: number;
  sanitize?: (raw: unknown) => T | null;
}) {
  return {
    get(ownerKey: string): T | null {
      try {
        const raw = localStorage.getItem(config.key);
        if (!raw) return null;

        const map = JSON.parse(raw);
        if (!map || typeof map !== 'object') return null;

        const entry = map[ownerKey] as ClientCacheEntry<unknown> | undefined;
        if (!entry || typeof entry !== 'object') return null;

        // 版本不匹配 → 清理该用户条目
        if (entry.v !== config.version) {
          delete map[ownerKey];
          localStorage.setItem(config.key, JSON.stringify(map));
          return null;
        }

        // TTL 过期 → 清理该用户条目
        if (typeof entry.ts !== 'number' || Date.now() - entry.ts > config.ttlMs) {
          delete map[ownerKey];
          localStorage.setItem(config.key, JSON.stringify(map));
          return null;
        }

        if (config.sanitize) {
          const sanitized = config.sanitize(entry.d);
          if (sanitized === null) {
            delete map[ownerKey];
            localStorage.setItem(config.key, JSON.stringify(map));
            return null;
          }
          return sanitized;
        }

        return entry.d as T;
      } catch {
        return null;
      }
    },

    set(ownerKey: string, data: T): void {
      try {
        const raw = localStorage.getItem(config.key);
        const map: Record<string, ClientCacheEntry<unknown>> =
          raw ? JSON.parse(raw) : {};
        if (!map || typeof map !== 'object') return;

        map[ownerKey] = { v: config.version, d: data, ts: Date.now() };
        localStorage.setItem(config.key, JSON.stringify(map));
      } catch {
        console.warn(`[ownerKeyCache] Failed to write ${config.key}`);
      }
    },

    remove(ownerKey: string): void {
      try {
        const raw = localStorage.getItem(config.key);
        if (!raw) return;
        const map = JSON.parse(raw);
        if (!map || typeof map !== 'object') return;
        delete map[ownerKey];
        localStorage.setItem(config.key, JSON.stringify(map));
      } catch {}
    },
  };
}
