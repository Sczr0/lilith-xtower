"use client";

import { useEffect, useRef, useState } from "react";
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
  const [order, setOrder] = useState<number[]>([]);
  const timerRef = useRef<number | null>(null);

  // 重建播放顺序（随机/顺序）
  useEffect(() => {
    const n = tips.length;
    if (n === 0) {
      setOrder([]);
      setIdx(0);
      return;
    }
    const base = Array.from({ length: n }, (_, i) => i);
    if (randomize) {
      // Fisher-Yates 洗牌
      for (let i = base.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [base[i], base[j]] = [base[j], base[i]];
      }
    }
    setOrder(base);
    setIdx(0);
  }, [tips, randomize]);

  // 轮播计时器
  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    const len = (order.length || tips.length) || 1;
    timerRef.current = window.setInterval(() => {
      setIdx((i) => {
        const next = (i + 1) % len;
        // 到达一轮末尾时在随机模式下重洗，避免固定顺序循环
        if (randomize && next === 0 && (order.length || tips.length) > 1) {
          const n = tips.length;
          const arr = Array.from({ length: n }, (_, k) => k);
          for (let a = arr.length - 1; a > 0; a--) {
            const b = Math.floor(Math.random() * (a + 1));
            [arr[a], arr[b]] = [arr[b], arr[a]];
          }
          setOrder(arr);
        }
        return next;
      });
    }, Math.max(1000, intervalMs));
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [tips, order, randomize, intervalMs]);

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

