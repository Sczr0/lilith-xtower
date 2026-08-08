"use client";

import { useCallback, useEffect, useRef } from "react";

interface Options {
  shouldPoll: boolean;
  url?: string;
  onReachable?: () => void;
}

// 使用相对路径，通过 next.config.ts rewrites 转发到后端健康检查
const DEFAULT_URL = "/health";

export function useServiceReachability({ shouldPoll, url = DEFAULT_URL, onReachable }: Options) {
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const backoffIndexRef = useRef(0);
  const isPollingRef = useRef(false);

  const delaysRef = useRef([5000, 10000, 30000, 60000]);
  const tickRef = useRef<(() => Promise<void>) | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    abortRef.current?.abort();
    abortRef.current = null;
    isPollingRef.current = false;
    backoffIndexRef.current = 0;
  }, [clearTimer]);

  const schedule = useCallback((delay: number) => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      void tickRef.current?.();
    }, delay);
  }, [clearTimer]);

  // tickRef 的赋值必须在 effect 中进行：render 期间写 ref 违反
  // react-hooks/refs 规则（ref 不应参与渲染）
  useEffect(() => {
    tickRef.current = async () => {
      if (isPollingRef.current) return;
      if (document.hidden) {
        // 说明：延迟到页面可见时再尝试
        schedule(2000);
        return;
      }
      if (navigator && typeof navigator.onLine === "boolean" && !navigator.onLine) {
        // 说明：离线状态下等待网络恢复
        schedule(3000);
        return;
      }

      isPollingRef.current = true;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      // 超时控制
      const timeoutId = window.setTimeout(() => ac.abort(), 4000);

      try {
        const res = await fetch(url, {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: ac.signal,
        });

        // 仅当明确拿到 2xx 且 status: ok 时认为可用
        if (res.ok) {
          let ok = false;
          try {
            const data = await res.json();
            ok = data && (data.status === "ok" || data.ok === true);
          } catch {
            ok = false;
          }
          if (ok) {
            stop();
            onReachable?.();
            return;
          }
        }
      } catch {
        // 忽略，走退避
      } finally {
        window.clearTimeout(timeoutId);
        isPollingRef.current = false;
      }

      // 失败：指数退避直至封顶
      const delays = delaysRef.current;
      const idx = backoffIndexRef.current;
      const delay = delays[Math.min(idx, delays.length - 1)];
      backoffIndexRef.current = Math.min(idx + 1, delays.length - 1);
      schedule(delay);
    };
    // onReachable/url 可能随渲染变化，重新赋值保持闭包最新
  }, [onReachable, schedule, stop, url]);

  useEffect(() => {
    if (!shouldPoll) {
      stop();
      return;
    }

    // 立即尝试一次
    backoffIndexRef.current = 0;
    schedule(0);

    const handleOnline = () => schedule(0);
    const handleVisible = () => schedule(0);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisible);

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisible);
      stop();
    };
  }, [shouldPoll, url, schedule, stop]);
}
