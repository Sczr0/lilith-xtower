'use client';

import { useSyncExternalStore } from 'react';

type VoidFn = () => void;

const subscribeNoop = (): VoidFn => () => {};

/**
 * 在客户端读取“仅浏览器可用”的同步值，并在 hydration 之后自动对齐到客户端快照。
 *
 * 说明：
 * - 通过 `useSyncExternalStore` 的 getServerSnapshot 保证首帧与静态 HTML 一致，避免 hydration mismatch。
 * - 适用场景：localStorage、navigator.userAgent、window.location 等。
 * - 非适用：需要持续订阅变化的外部状态（请自行实现 subscribe）。
 */
export function useClientValue<T>(getClientValue: () => T, serverValue: T): T {
  return useSyncExternalStore(
    subscribeNoop,
    () => {
      try {
        return getClientValue();
      } catch {
        return serverValue;
      }
    },
    () => serverValue,
  );
}

