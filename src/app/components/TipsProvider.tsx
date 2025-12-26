"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * TipsProvider：集中管理 Tips 加载与缓存，供全站消费
 * - 仅在客户端加载，避免 SSR 期间访问 DOM
 * - 支持 basePath/assetPrefix 探测，适配子路径部署
 * - 兼容多种命名：tips.txt / Tip.txt / Tips.txt / tip.txt
 * - 忽略空行与以 # 开头的注释行
 * - 去重并裁剪
 */

export type TipsState = "idle" | "loading" | "loaded" | "error";

interface TipsContextValue {
  state: TipsState;
  tips: string[];
  error?: string;
  reload: () => Promise<void>;
}

const TipsContext = createContext<TipsContextValue | null>(null);

// 少量内置默认文案，确保在加载失败时仍有信息展示
const DEFAULT_TIPS: string[] = [
  "提示：登录后可在仪表盘生成 Best N 图片",
  "提示：网站已针对移动端优化，桌面端同样可用",
  "提示：如遇网络波动，稍候将自动重试",
];

// 说明：622 条 tips 的嵌入式数据体积较大（~30KB+），若静态导入会进入全站共享首屏 bundle。
// 为降低所有页面的首屏 JS，我们在客户端空闲期再动态加载 `tips.data`，并在弱网/省流/减少数据偏好下跳过加载。
interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
}

function shouldLoadEmbeddedTips(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const nav = navigator as NavigatorWithConnection;
    if (nav?.connection?.saveData) return false;
    if (window.matchMedia?.("(prefers-reduced-data: reduce)").matches) return false;
    const effectiveType = nav?.connection?.effectiveType;
    if (effectiveType === "slow-2g" || effectiveType === "2g") return false;
    return true;
  } catch {
    return true;
  }
}

function runWhenIdle(callback: () => void, timeout = 2000): void {
  if (typeof window === "undefined") return;
  try {
    const idle = (window as Window & { requestIdleCallback?: typeof requestIdleCallback }).requestIdleCallback;
    if (typeof idle === "function") {
      idle(callback, { timeout });
    } else {
      setTimeout(callback, 0);
    }
  } catch {
    setTimeout(callback, 0);
  }
}

// 解析 tips 文本：按行分割，去除空行与注释
export function parseTipsText(text: string): string[] {
  const lines = text
    .split(/\r?\n/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("#"));
  // 去重
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) if (!seen.has(l)) { seen.add(l); out.push(l); }
  return out;
}

type EmbeddedTipsModule = { EMBEDDED_TIPS?: string[] };

export function TipsProvider({ children }: { children: React.ReactNode }) {
  // 首屏兜底：先使用少量默认 tips，避免任何额外网络/解析成本
  const [state, setState] = useState<TipsState>("loaded");
  const [tips, setTips] = useState<string[]>(DEFAULT_TIPS);
  const [error, setError] = useState<string | undefined>(undefined);

  const loadEmbeddedTips = useCallback(async () => {
    try {
      const mod = (await import("./tips.data")) as EmbeddedTipsModule;
      const embedded = mod?.EMBEDDED_TIPS;
      if (Array.isArray(embedded) && embedded.length > 0) {
        setTips(embedded);
        setState("loaded");
        setError(undefined);
      }
    } catch (e) {
      // 加载失败不影响主流程：保持 DEFAULT_TIPS 即可
      setState("error");
      setError(e instanceof Error ? e.message : "加载 tips 失败");
    }
  }, []);

  // 空闲期加载：避免进入首屏关键路径（LCP/INP）
  useEffect(() => {
    if (!shouldLoadEmbeddedTips()) return;
    runWhenIdle(() => {
      setState("loading");
      loadEmbeddedTips();
    }, 2000);
  }, [loadEmbeddedTips]);

  const reload = useCallback(async () => {
    setState("loading");
    await loadEmbeddedTips();
  }, [loadEmbeddedTips]);

  const value = useMemo(() => ({ state, tips, error, reload }), [state, tips, error, reload]);
  return <TipsContext.Provider value={value}>{children}</TipsContext.Provider>;
}

export function useTips(): TipsContextValue {
  const ctx = useContext(TipsContext);
  if (!ctx) {
    // 未包裹 Provider 时兜底返回默认值，避免崩溃
    return {
      state: "idle",
      tips: DEFAULT_TIPS,
      reload: async () => {},
    };
  }
  return ctx;
}
