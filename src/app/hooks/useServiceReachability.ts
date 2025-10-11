"use client";

import { useEffect, useRef } from "react";

interface Options {
  shouldPoll: boolean;
  url?: string;
  onReachable?: () => void;
}

const DEFAULT_URL = "https://seekend.xtower.site/health";

export function useServiceReachability({ shouldPoll, url = DEFAULT_URL, onReachable }: Options) {
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const backoffIndexRef = useRef(0);
  const isPollingRef = useRef(false);

  const delays = [5000, 10000, 30000, 60000];

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const stop = () => {
    clearTimer();
    abortRef.current?.abort();
    abortRef.current = null;
    isPollingRef.current = false;
    backoffIndexRef.current = 0;
  };

  const schedule = (delay: number) => {
    clearTimer();
    timerRef.current = window.setTimeout(tick, delay);
  };

  const tick = async () => {
    if (isPollingRef.current) return;
    if (document.hidden) {
      // 延迟到页面可见时再尝试
      schedule(2000);
      return;
    }
    if (navigator && typeof navigator.onLine === "boolean" && !navigator.onLine) {
      // 离线状态下等待网络恢复
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
        headers: { "Accept": "application/json" },
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
    const idx = backoffIndexRef.current;
    const delay = delays[Math.min(idx, delays.length - 1)];
    backoffIndexRef.current = Math.min(idx + 1, delays.length - 1);
    schedule(delay);
  };

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
  }, [shouldPoll, url]);
}
