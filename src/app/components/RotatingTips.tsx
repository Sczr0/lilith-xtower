"use client";

import { useEffect, useRef, useState } from "react";
import { useTips } from "./TipsProvider";

interface RotatingTipsProps {
  /** 轮换间隔（毫秒），默认 3000ms */
  intervalMs?: number;
  /** 自定义类名 */
  className?: string;
}

/**
 * RotatingTips：轮播展示 Tips，数据来自 TipsProvider
 * - 不直接发起网络请求，仅消费上下文，避免多处重复加载
 * - 在 tips 更新时自动重置轮播索引
 */
export function RotatingTips({ intervalMs = 3000, className = "" }: RotatingTipsProps) {
  const { tips, state } = useTips();
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<number | null>(null);

  // tips 变化时重置索引
  useEffect(() => {
    setIdx(0);
  }, [tips]);

  // 轮播计时器
  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    const len = tips.length || 1;
    timerRef.current = window.setInterval(() => {
      setIdx((i) => (i + 1) % len);
    }, Math.max(1000, intervalMs));
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [tips, intervalMs]);

  const tip = tips.length ? tips[idx] : state === "loading" ? "加载中…" : "";

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

