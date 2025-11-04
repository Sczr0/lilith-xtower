"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

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

// 构造候选 URL 列表：同时包含前缀与根路径版本
function buildCandidates(prefix: string): string[] {
  const names = ["tips.txt", "Tip.txt", "Tips.txt", "tip.txt"];
  const out: string[] = [];
  for (const n of names) {
    if (prefix) out.push(`${prefix}/${n}`);
    out.push(`/${n}`);
  }
  return out;
}

// 探测 basePath / 资源前缀
function detectStaticPrefix(): string {
  // 1) 优先使用 NEXT_PUBLIC_BASE_PATH（如提供）
  const envBase = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim();
  if (envBase && envBase.startsWith("/")) return envBase.replace(/\/$/, "");
  // 2) 读取 __NEXT_DATA__.assetPrefix（若存在且为相对路径）
  try {
    const anyWin = window as unknown as { __NEXT_DATA__?: any };
    const ap = anyWin?.__NEXT_DATA__?.assetPrefix;
    if (typeof ap === "string" && ap.startsWith("/")) return ap.replace(/\/$/, "");
  } catch {}
  // 3) 扫描本地 _next 脚本 src，提取前缀
  try {
    const scripts = Array.from(document.scripts) as HTMLScriptElement[];
    for (const s of scripts) {
      const src = s.getAttribute("src") || "";
      if (src.startsWith("/") && src.includes("/_next/")) {
        const idx = src.indexOf("/_next/");
        const prefix = src.slice(0, idx);
        return prefix || "";
      }
    }
  } catch {}
  return "";
}

export function TipsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TipsState>("idle");
  const [tips, setTips] = useState<string[]>(DEFAULT_TIPS);
  const [error, setError] = useState<string | undefined>(undefined);
  const onceRef = useRef(false);

  const reload = useCallback(async () => {
    setState("loading");
    setError(undefined);
    try {
      const prefix = typeof window !== "undefined" ? detectStaticPrefix() : "";
      const candidates = buildCandidates(prefix);
      let loaded: string[] | null = null;
      for (const url of candidates) {
        try {
          const res = await fetch(url, { cache: "no-store", headers: { Accept: "text/plain" } });
          if (!res.ok) continue;
          const text = await res.text();
          const arr = parseTipsText(text);
          if (arr.length > 0) { loaded = arr; break; }
        } catch {}
      }
      if (loaded && loaded.length > 0) {
        setTips(loaded);
        setState("loaded");
        return;
      }
      setState("error");
      setError("未找到有效的 tips 文件");
    } catch (e: any) {
      setState("error");
      setError(e?.message || "加载 tips 失败");
    }
  }, []);

  // 首次空闲时加载，尽量不阻塞首屏
  useEffect(() => {
    if (onceRef.current) return;
    onceRef.current = true;
    if (typeof window === "undefined") return;
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(() => { reload(); }, { timeout: 1500 });
    } else {
      // 退化：load 事件后加载
      const w = window as Window & typeof globalThis;
      const onLoad = () => { void reload(); };
      w.addEventListener("load", onLoad, { once: true } as AddEventListenerOptions);
    }
  }, [reload]);

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

// 测试辅助导出（不在生产中直接使用）
export const __buildCandidatesForTest = buildCandidates;
