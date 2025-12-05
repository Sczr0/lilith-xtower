"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { EMBEDDED_TIPS } from "./tips.data";

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

// 注意：预编译模式下不再进行网络加载与前缀探测

export function TipsProvider({ children }: { children: React.ReactNode }) {
  // 预编译模式：直接使用嵌入式常量
  const [state] = useState<TipsState>("loaded");
  const [tips] = useState<string[]>(EMBEDDED_TIPS && EMBEDDED_TIPS.length > 0 ? EMBEDDED_TIPS : DEFAULT_TIPS);
  const [error] = useState<string | undefined>(undefined);
  const reload = useCallback(async () => { /* no-op in embedded mode */ }, []);

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
