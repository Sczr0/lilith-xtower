'use client';

import { useSyncExternalStore } from 'react';

/** 与 Tailwind 的 md 断点一致（min-width: 768px）。 */
const DESKTOP_QUERY = '(min-width: 768px)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(DESKTOP_QUERY).matches;
}

/** 服务端与首帧一律返回 null（未知），使两套 DOM 同时存在、由 CSS 决定显隐。 */
function getServerSnapshot(): null {
  return null;
}

/**
 * 是否处于桌面断点；`null` 表示「尚未确定」（服务端与 hydration 首帧）。
 *
 * 为什么是三态而不是 boolean：
 * 服务端拿不到视口宽度，若直接按断点做首屏分支，必然二选一地出错——
 * 要么丢失 SSR 内容（选了 null 侧不渲染），要么在另一类设备上先渲染错误的一套再切换。
 * 因此约定：`isDesktop === null` 时**两套都渲染**，由 CSS（`md:hidden` / `hidden md:block`）
 * 决定谁可见；断点确定后再只渲染一套，消除重复 DOM 与多余的虚拟化器。
 *
 * 使用真实订阅（matchMedia change），因此旋转屏幕/缩放窗口时会正确切换。
 */
export function useIsDesktop(): boolean | null {
  return useSyncExternalStore<boolean | null>(subscribe, getSnapshot, getServerSnapshot);
}
