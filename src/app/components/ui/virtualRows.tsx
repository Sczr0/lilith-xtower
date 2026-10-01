'use client';

import { useCallback, useRef, useState, type CSSProperties, type RefObject } from 'react';
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

export interface UseVirtualRowsOptions {
  /**
   * 卡片列表模式（绝对定位摆放 + `mb-*` 间距）。
   *
   * 卡片高度随视口宽度变化、写不成常量，所以用「已测量卡片的平均高度」持续校准 estimateSize：
   * 卡片高度一致时（同一视口下）首帧即可收敛到精确值；高度不一致时平均值也会很快逼近真实均值，
   * 总高度不再像固定估算值那样一路偏下去（实测 RKS 移动端滚动 25 步内容高度 2794→8890px）。
   *
   * 同时把 `margin-bottom` 计入每项的占位高度：卡片是绝对定位，margin 不参与定位，
   * 此前这段间距完全没生效（卡片彼此贴在一起）。间距值仍从 CSS 读，不做二次硬编码。
   */
  cardList?: boolean;
}

/** 卡片模式下估算值与实测均值的容差：小于 1px 就不再更新，避免每次测量都触发一轮渲染。 */
const CARD_ESTIMATE_TOLERANCE = 1;

/** 读取一项的占位高度：卡片模式下额外加上 margin-bottom（绝对定位下 margin 不参与定位）。 */
function readItemSize(element: Element, withBottomGap: boolean): number {
  const el = element as HTMLElement;
  if (!withBottomGap) return el.offsetHeight;
  const gap = Number.parseFloat(window.getComputedStyle(el).marginBottom) || 0;
  return el.offsetHeight + gap;
}

/**
 * 表格 / 长列表虚拟化的统一入口。
 *
 * 表格用法：把 scrollRef 与 scrollClassName 挂到滚动容器 div，
 * 然后在 tbody 内先渲染 `paddingTop` 高的占位行，再渲染 virtualItems 对应的行，
 * 最后渲染 `paddingBottom` 高的占位行（用 VirtualSpacerRow）。
 *
 * 卡片列表用法：传 `{ cardList: true }`，把 scrollRef 挂到滚动容器（position: relative），
 * 每张卡片用 virtualItemStyle() 绝对定位；行高由「已测量卡片的平均高度」校准，
 * 并且必须额外渲染一个 height = totalSize 的占位元素撑出完整滚动长度。
 *
 * 注意：虚拟化会把「页面整体滚动」变为「容器内滚动」，这是刻意的 UX 取舍，
 * 视口高度由调用方通过 className 的 max-h 控制。
 *
 * estimateSize 必须是「该行最终真实高度」的准确估计（行高固定时就直接填那个常量）：
 * 虚拟化先用它算出每行的位置与总高度，再靠 measureElement 逐行校正；两者不一致时，
 * 每测量到一行就改一次总高度，滚动过程中滚动条与下方内容持续变长/变短（实测 300 行列表
 * 滚动 60 步，内容高度从 16464px 涨到 21377px），表现为「滚轮一滑行距/格式就在变」。
 */
export function useVirtualRows(
  count: number,
  estimateSize: number,
  options: UseVirtualRowsOptions = {},
): VirtualRows {
  const { cardList = false } = options;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [calibratedSize, setCalibratedSize] = useState<number | null>(null);
  // 卡片校准用：已测量卡片的高度累加值 + 去重（同一 index 只计入一次，避免来回滚动重复计数）
  const calibrationRef = useRef<{ sum: number; count: number; seen: Set<string> }>({
    sum: 0,
    count: 0,
    seen: new Set<string>(),
  });

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    // 卡片模式下用实测均值校准估算值（同一视口下高度一致的列表首帧即精确）。
    estimateSize: () => calibratedSize ?? estimateSize,
    overscan: OVERSCAN,
    // 卡片模式需要把 margin-bottom 计入占位高度；表格模式保持库默认（优先用 ResizeObserver
    // 的 borderBoxSize，误差更小），因此这里不覆盖。
    measureElement: cardList ? (element) => readItemSize(element, true) : undefined,
    // 关键：没有滚动元素（服务端渲染、以及挂载前的首帧）时 getSize() 回退到这里，
    // 否则 calculateRange 因 outerSize === 0 返回 null，服务端会一行都不渲染。
    // 取滚动视口高度，使服务端渲染出「首屏可见的那几行」。
    initialRect: { width: 0, height: VIRTUAL_VIEWPORT_MAX_HEIGHT },
  });

  const measureElement = useCallback(
    (el: Element | null) => {
      if (el && cardList) {
        const measured = readItemSize(el, true);
        const index = el.getAttribute('data-index');
        const acc = calibrationRef.current;
        if (measured > 0 && index !== null && !acc.seen.has(index)) {
          acc.seen.add(index);
          acc.sum += measured;
          acc.count += 1;
          const average = Math.round(acc.sum / acc.count);
          setCalibratedSize((prev) =>
            prev !== null && Math.abs(average - prev) < CARD_ESTIMATE_TOLERANCE ? prev : average,
          );
        }
      }
      virtualizer.measureElement(el);
    },
    [cardList, virtualizer],
  );

  return {
    scrollRef,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
    measureElement,
    // overflow-anchor:none —— 虚拟化会在滚动时改动可视窗口上方的占位行高度，
    // 浏览器的「滚动锚定」会因此想把滚动位置拉回去，与虚拟化自身的滚动补偿互相打架，
    // 表现为滚动时的窜动/闪烁。关掉锚定，位置完全交给虚拟化计算。
    scrollClassName: 'overflow-auto overscroll-contain [overflow-anchor:none]',
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
