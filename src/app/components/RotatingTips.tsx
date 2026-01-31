"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTips } from "./TipsProvider";

interface RotatingTipsProps {
  /** 轮换间隔（毫秒），默认 3000ms */
  intervalMs?: number;
  /** 是否随机展示（洗牌模式），默认 true */
  randomize?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * RotatingTips：轮播展示 Tips（支持随机洗牌，避免短时间重复）
 * - 仅消费 TipsProvider 提供的数据，不做网络请求
 * - tips 变化或 randomize 切换时，重建播放顺序
 */
export function RotatingTips({ intervalMs = 3000, randomize = true, className = "" }: RotatingTipsProps) {
  const { tips, state } = useTips();
  const [idx, setIdx] = useState(0);
  const [seed, setSeed] = useState(0);
  const timerRef = useRef<number | null>(null);

  const order = useMemo(() => buildOrder(tips.length, randomize, seed), [tips.length, randomize, seed]);

  // 初始化随机 seed：避免在首次 render 阶段使用真实随机（会造成 SSR/CSR hydration mismatch）。
  // - mount 后生成一次随机 seed：同一次会话内顺序稳定，但不同刷新/会话的顺序不同。
  // - tips 从 DEFAULT_TIPS 切换到 EMBEDDED_TIPS（长度变化）或 randomize 打开时，也应重新随机并从头开始。
  useEffect(() => {
    if (!randomize) return;
    if (tips.length <= 1) return;
    setIdx(0);
    setSeed(getRandomSeed32());
  }, [randomize, tips.length]);

  // 轮播计时器
  useEffect(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const len = tips.length;
    if (len <= 0) return;

    timerRef.current = window.setInterval(() => {
      setIdx((i) => {
        const next = (i + 1) % len;

        // 到达一轮末尾时在随机模式下重洗（通过 seed 变更生成新的确定性顺序）
        if (randomize && next === 0 && len > 1) {
          setSeed((s) => (s + 1) >>> 0);
        }

        return next;
      });
    }, Math.max(1000, intervalMs));
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [tips.length, randomize, intervalMs]);

  const currentIndex = order.length ? order[idx % order.length] : idx % (tips.length || 1);
  const tip = tips.length ? tips[currentIndex] : state === "loading" ? "加载中…" : "";

  return (
    <div className={`mt-3 text-sm text-gray-600 dark:text-gray-300 select-none ${className}`} aria-live="polite">
      <span className="inline-flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="text-blue-600 dark:text-blue-400">
          <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 2.38 1.2 4.47 3 5.73V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.27A6.997 6.997 0 0 0 19 9a7 7 0 0 0-7-7Zm-2 18h4v2h-4v-2Z" />
        </svg>
        <span>{tip}</span>
      </span>
    </div>
  );
}

function buildOrder(length: number, randomize: boolean, seed: number): number[] {
  if (length <= 0) return [];
  const base = Array.from({ length }, (_, i) => i);
  if (!randomize || length <= 1) return base;

  // 说明：使用固定 seed 的伪随机，保证同一轮渲染顺序稳定；seed 变化时重新洗牌。
  let state = (seed || 1) >>> 0;
  const nextRand = () => {
    // LCG: Numerical Recipes
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };

  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base;
}

function getRandomSeed32(): number {
  try {
    const getRandomValues = globalThis.crypto?.getRandomValues?.bind(globalThis.crypto);
    if (typeof getRandomValues === "function") {
      const out = new Uint32Array(1);
      getRandomValues(out);
      const seed = out[0] >>> 0;
      return seed === 0 ? 1 : seed;
    }
  } catch {}

  // fallback：不要求加密强度，仅用于“会话级随机”打散展示顺序
  const seed = ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
  return seed;
}
