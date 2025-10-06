"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

// 生成任务类别，可扩展：如 'best-n'、'song' 等
export type GenerationCategory = string;

type InFlightMap = Record<string, boolean>;

interface GenerationContextValue {
  // 指定类别是否正在生成中
  isBusy: (key: GenerationCategory) => boolean;
  // 发起生成任务；同一类别已有任务时直接复用并返回原 Promise
  startTask: <T>(key: GenerationCategory, task: () => Promise<T>) => Promise<T>;
  // 读取指定类别的最近一次结果（跨页面保留）
  getResult: <T = unknown>(key: GenerationCategory) => T | null;
  // 清除指定类别的结果
  clearResult: (key: GenerationCategory) => void;
}

const GenerationContext = createContext<GenerationContextValue | null>(null);

export function GenerationProvider({ children }: { children: React.ReactNode }) {
  // 使用状态以触发订阅组件重渲染
  const [inFlight, setInFlight] = useState<InFlightMap>({});
  // 最近一次任务结果，跨页面保留（例如 Blob 用于图片展示）
  const [results, setResults] = useState<Record<string, unknown>>({});
  // 保存实际 Promise，避免重复发起（不放入 state 防止不必要的重渲染）
  const promisesRef = useRef<Record<string, Promise<unknown>>>({});

  const isBusy = useCallback((key: GenerationCategory) => {
    return Boolean(inFlight[key]);
  }, [inFlight]);

  const startTask = useCallback(<T,>(key: GenerationCategory, task: () => Promise<T>): Promise<T> => {
    // 已有进行中的任务则直接返回原 Promise，避免重复请求
    const existing = promisesRef.current[key] as Promise<T> | undefined;
    if (existing) return existing;

    setInFlight(prev => ({ ...prev, [key]: true }));

    const p = (async () => {
      try {
        const res = await task();
        // 缓存结果，便于页面切换后仍可读取显示
        setResults(prev => ({ ...prev, [key]: res }));
        return res;
      } finally {
        // 任务结束后释放占用
        setInFlight(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        delete promisesRef.current[key];
      }
    })();

    promisesRef.current[key] = p as unknown as Promise<unknown>;
    return p;
  }, []);

  const getResult = useCallback(<T,>(key: GenerationCategory): T | null => {
    return (results[key] as T) ?? null;
  }, [results]);

  const clearResult = useCallback((key: GenerationCategory) => {
    setResults(prev => {
      const next = { ...prev } as Record<string, unknown>;
      delete next[key];
      return next;
    });
  }, []);

  const value = useMemo<GenerationContextValue>(() => ({ isBusy, startTask, getResult, clearResult }), [isBusy, startTask, getResult, clearResult]);

  return (
    <GenerationContext.Provider value={value}>
      {children}
    </GenerationContext.Provider>
  );
}

export function useGenerationManager(): GenerationContextValue {
  const ctx = useContext(GenerationContext);
  if (!ctx) throw new Error("useGenerationManager 必须在 GenerationProvider 中使用");
  return ctx;
}

// 便捷 Hook：订阅某一类别的忙碌状态
export function useGenerationBusy(key: GenerationCategory): boolean {
  const { isBusy } = useGenerationManager();
  return isBusy(key);
}

// 便捷 Hook：获取最近一次的生成结果（例如图片 Blob），用于跨页面展示
export function useGenerationResult<T = unknown>(key: GenerationCategory): T | null {
  const { getResult } = useGenerationManager();
  return getResult<T>(key);
}

// 便捷 Hook：清除某个类别的结果
export function useClearGenerationResult(): (key: GenerationCategory) => void {
  const { clearResult } = useGenerationManager();
  return clearResult;
}
