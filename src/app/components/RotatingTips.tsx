"use client";

import { useEffect, useRef, useState } from "react";

interface RotatingTipsProps {
  /** 轮换间隔（毫秒），默认 3000ms */
  intervalMs?: number;
  /** 自定义类名 */
  className?: string;
}

/**
 * 加载提示（轮换展示）
 * - 从 `/tips.txt` 读取，每行一个 Tip；若不可用则使用内置默认文案
 * - 仅在客户端渲染时请求，一次加载，内存缓存于组件周期内
 */
export function RotatingTips({ intervalMs = 3000, className = "" }: RotatingTipsProps) {
  const [tips, setTips] = useState<string[]>([
    "提示：登录后可在仪表盘生成 Best N 图片",
    "提示：移动端优先优化，桌面同样可用",
    "提示：如遇网络波动，稍候将自动重试",
  ]);
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const load = async (path: string) => {
        const res = await fetch(path, { cache: "no-store", headers: { Accept: 'text/plain' } });
        if (!res.ok) return null;
        const text = await res.text();
        return text
          .split(/\r?\n/g)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith("#"));
      };
      try {
        let lines = await load('/tips.txt');
        if ((!lines || lines.length === 0)) {
          // 兼容大小写差异的文件名
          lines = await load('/Tips.txt');
        }
        if (mounted && lines && lines.length > 0) setTips(lines);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setIdx((i) => (i + 1) % (tips.length || 1));
    }, Math.max(1000, intervalMs));
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [tips, intervalMs]);

  const tip = tips.length ? tips[idx] : "加载中…";

  return (
    <div className={`mt-3 text-sm text-gray-600 dark:text-gray-300 select-none ${className}`}
         aria-live="polite">
      <span className="inline-flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"
             className="text-blue-600 dark:text-blue-400">
          <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 2.38 1.2 4.47 3 5.73V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.27A6.997 6.997 0 0 0 19 9a7 7 0 0 0-7-7Zm-2 18h4v2h-4v-2Z"/>
        </svg>
        <span>{tip}</span>
      </span>
    </div>
  );
}
