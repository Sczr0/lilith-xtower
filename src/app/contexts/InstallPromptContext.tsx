"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// Chrome/Edge/Android 的 beforeinstallprompt 事件类型（TS 标准库未包含，需自行声明）
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface InstallPromptValue {
  // 是否有可用的 deferred prompt（Chrome/Edge/Android：可直接触发安装）
  canInstall: boolean;
  // 是否 iOS 类设备（无 beforeinstallprompt，需手动分享到主屏幕）
  isIos: boolean;
  // 是否已作为独立 PWA 运行（安装后不再展示安装入口）
  isStandalone: boolean;
  install: () => Promise<void>;
}

const InstallPromptContext = createContext<InstallPromptValue | null>(null);

function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
  } catch {
    /* ignore */
  }
  // iOS Safari 的旧式 standalone 标志
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iP(?:hone|ad|od)/.test(ua);
}

// 兼容支持 addEventListener / addListener 两种 API 的 MediaQueryList
function subscribeDisplayMode(onChange: (matches: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  if (typeof window.matchMedia !== "function") return () => {};
  const mql = window.matchMedia("(display-mode: standalone)");
  const handler = (e: MediaQueryListEvent | { matches: boolean }) => onChange(e.matches);
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }
  // 旧浏览器退化
  mql.addListener(handler);
  return () => mql.removeListener(handler);
}

export function InstallPromptProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState<boolean>(() => isRunningStandalone());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    const unsubscribeDisplayMode = subscribeDisplayMode(setStandalone);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      unsubscribeDisplayMode();
    };
  }, []);

  const isIos = useMemo(() => isIosDevice(), []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    // 触发浏览器原生的安装提示
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => undefined);
      if (choice?.outcome === "accepted") setStandalone(true);
    } catch {
      /* ignore */
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const value = useMemo<InstallPromptValue>(
    () => ({
      canInstall: Boolean(deferredPrompt),
      isIos,
      isStandalone: standalone,
      install,
    }),
    [deferredPrompt, isIos, standalone, install],
  );

  return <InstallPromptContext.Provider value={value}>{children}</InstallPromptContext.Provider>;
}

export function useInstallPrompt(): InstallPromptValue {
  const ctx = useContext(InstallPromptContext);
  if (!ctx) throw new Error("useInstallPrompt 必须在 InstallPromptProvider 中使用");
  return ctx;
}
