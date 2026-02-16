"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useClientValue } from "../hooks/useClientValue";
import { shouldPreloadLite } from "../lib/utils/preload-gate";

// 说明：PromoBanner 是“可选交互组件”，放在 app/layout 会让其 JS 进入所有页面的共享布局入口。
// 为降低首屏解析成本（INP/LCP 关键路径），这里用 dynamic 将其拆分为按需 chunk，并在空闲期再加载。
const PromoBanner = dynamic(() => import("./PromoBanner").then((m) => m.PromoBanner), {
  ssr: false,
  loading: () => null,
});

function isPromoBannerExcludedPath(pathname: string): boolean {
  // 与 `promo-banner.config.ts` 的 exclude 保持一致的“快速过滤”，避免在这些路由上触发动态加载。
  // 注意：这里不做复杂通配符解析，避免把 promo banner 配置/匹配逻辑带回到 layout chunk。
  return pathname === "/login" || pathname === "/debug-auth" || pathname.startsWith("/api");
}

export function PromoBannerSlot() {
  const pathname = usePathname() ?? "/";
  const shouldRenderByProfile = useClientValue(() => shouldPreloadLite(), false);
  // 省流/弱网偏好下不加载可选活动横幅，减少带宽与主线程占用
  if (!shouldRenderByProfile) return null;
  if (isPromoBannerExcludedPath(pathname)) return null;

  // 说明：以 pathname 作为 key，路由切换时自动重置横幅内部状态（current/collapsed 等）。
  return <PromoBanner key={pathname} pathname={pathname} />;
}

export default PromoBannerSlot;
