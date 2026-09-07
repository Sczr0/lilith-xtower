"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

type SwMessage = { type?: string; url?: string | null };

function subscribeOnline(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

// 客户端快照：真实在线状态；服务端渲染视为在线（不展示提示）
function getOnlineSnapshot() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/**
 * 轻量离线提示条：当浏览器离线，或 Service Worker 在导航时回退到缓存内容
 * （网络失败但 navigator.onLine 仍为 true 的场景）时，顶部悬浮一条小通知。
 * 不遮挡正文、不强提示；恢复联网或 SW 拉到新网络响应后自动消失。
 */
export function OfflineNotice() {
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, () => true);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent<SwMessage>) => {
      const type = event.data?.type;
      if (type === "OFFLINE_FALLBACK") setFallback(true);
      else if (type === "NETWORK_OK") setFallback(false);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (online && !fallback) return null;

  return (
    <div role="status" aria-live="polite" className="fixed left-1/2 top-16 z-[60] -translate-x-1/2">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900/90 dark:bg-neutral-100/90 text-white dark:text-neutral-900 rounded-full shadow-lg text-xs">
        <WifiOff className="w-3.5 h-3.5" />
        <span>当前处于离线状态，正在显示已缓存的内容</span>
      </div>
    </div>
  );
}
