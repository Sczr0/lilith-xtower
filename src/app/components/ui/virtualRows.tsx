'use client';

import { useRef, type CSSProperties, type RefObject } from 'react';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';

/** 虚拟化列表的滚动视口最大高度（px）。超出后改为容器内滚动。 */
export const VIRTUAL_VIEWPORT_MAX_HEIGHT = 640;

const OVERSCAN = 8;

export type VirtualRows = {
  /** 挂到滚动容器上 */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** 当前应渲染的行（其余用占位行撑高） */
  virtualItems: VirtualItem[];
  /** 所有行的总高度，用于计算上下占位高度 */
  totalSize: number;
  /** 挂到每一行的 ref（需同时设置 data-index），用于动态测量行高 */
  measureElement: (el: Element | null) => void;
  /** 滚动容器的 className（含 overscroll-contain，避免滚动穿透） */
  scrollClassName: string;
};

/**
 * 表格 / 长列表虚拟化的统一入口。
 *
 * 表格用法：把 scrollRef 与 scrollClassName 挂到滚动容器 div，
 * 然后在 tbody 内先渲染 `paddingTop` 高的占位行，再渲染 virtualItems 对应的行，
 * 最后渲染 `paddingBottom` 高的占位行（用 VirtualSpacerRow）。
 *
 * 注意：虚拟化会把「页面整体滚动」变为「容器内滚动」，这是刻意的 UX 取舍，
 * 视口高度由调用方通过 className 的 max-h 控制。
 */
export function useVirtualRows(count: number, estimateSize: number): VirtualRows {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan: OVERSCAN,
    // 关键：没有滚动元素（服务端渲染、以及挂载前的首帧）时 getSize() 回退到这里，
    // 否则 calculateRange 因 outerSize === 0 返回 null，服务端会一行都不渲染。
    // 取滚动视口高度，使服务端渲染出「首屏可见的那几行」。
    initialRect: { width: 0, height: VIRTUAL_VIEWPORT_MAX_HEIGHT },
  });

  return {
    scrollRef,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
    measureElement: (el) => virtualizer.measureElement(el),
    scrollClassName: 'overflow-auto overscroll-contain',
  };
}

/** 由虚拟项列表算出上下占位高度。 */
export function getSpacerHeights(virtualItems: VirtualItem[], totalSize: number): {
  paddingTop: number;
  paddingBottom: number;
} {
  if (virtualItems.length === 0) return { paddingTop: 0, paddingBottom: 0 };
  const first = virtualItems[0];
  const last = virtualItems[virtualItems.length - 1];
  return { paddingTop: first.start, paddingBottom: Math.max(0, totalSize - last.end) };
}

/** 表格虚拟化占位行：撑出未渲染区域的高度，保持滚动条比例正确。 */
export function VirtualSpacerRow({ height }: { height: number }) {
  if (height <= 0) return null;
  return <tr aria-hidden="true" style={{ height, padding: 0, border: 0 }} />;
}

/**
 * 非表格列表（卡片）虚拟化用的定位样式。
 *
 * 卡片用绝对定位 + translateY 摆放，而不是占位块；滚动容器需同时设置
 * `position: relative`、`height: <totalSize>`（配合 max-height 形成视口），
 * 这样列表原有的间距/换行行为不会干扰行高计算。
 */
export function virtualItemStyle(start: number): CSSProperties {
  return {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    transform: `translateY(${start}px)`,
  };
}
