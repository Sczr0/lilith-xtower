"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Download, Share, X } from "lucide-react";
import { useInstallPrompt } from "../contexts/InstallPromptContext";

type InstallButtonVariant = "row" | "icon";

interface InstallButtonProps {
  /** row：侧边栏等整行按钮；icon：顶栏等图标态紧凑按钮 */
  variant?: InstallButtonVariant;
  /** 收起态：只显示图标（仅 row 生效，侧边栏收起时使用） */
  collapsed?: boolean;
  className?: string;
  /** 触发后回调（如关闭移动端菜单） */
  onAction?: () => void;
}

// 水合安全的“是否客户端”标记：服务端渲染为 false，客户端挂载后为 true，
// 避免 isIos / standalone 检测在 SSR 与首屏水合不一致导致 hydration 警告。
function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {}, // 无订阅
    () => true,
    () => false,
  );
}

// iOS 手动添加引导：顶栏图标态下以固定浮层呈现（portal 到 body，避免被变换祖先
// 影响定位），不改变顶栏布局。
function IosInstallToast({ onClose }: { onClose: () => void }) {
  return (
    <div role="status" aria-live="polite" className="fixed left-1/2 top-16 z-[70] -translate-x-1/2">
      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-xs w-max max-w-[90vw]">
        <span className="text-gray-700 dark:text-gray-300">
          在 Safari 中点击底部「分享」，再选择「添加到主屏幕」。
        </span>
        <button
          type="button"
          onClick={onClose}
          className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
          aria-label="关闭提示"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * 自定义“安装到主屏幕/添加到桌面”按钮。
 * - Chrome/Edge/Android：点击触发浏览器原生安装提示（beforeinstallprompt）。
 * - iOS：无原生事件，点击后展示轻量手动添加引导。
 * - 已在 standalone 模式下运行（已安装）时不渲染。
 */
export function InstallButton({ variant = "row", collapsed, className, onAction }: InstallButtonProps) {
  const { canInstall, isIos, isStandalone, install } = useInstallPrompt();
  const [hintOpen, setHintOpen] = useState(false);
  const client = useIsClient();

  if (!client) return null;
  // 已安装为 PWA 则不展示
  if (!canInstall && !isIos) return null;
  if (isStandalone) return null;

  const label = isIos ? "添加到主屏幕" : "安装到桌面";
  const IconComponent = isIos ? Share : Download;

  const handleClick = () => {
    if (isIos) {
      setHintOpen((v) => !v);
    } else {
      void install();
    }
    onAction?.();
  };

  // 顶栏图标态
  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-neutral-800 transition-colors"
          title={label}
          aria-label={label}
        >
          <IconComponent className="w-5 h-5" />
        </button>
        {hintOpen &&
          isIos &&
          createPortal(<IosInstallToast onClose={() => setHintOpen(false)} />, document.body)}
      </>
    );
  }

  // 侧边栏整行态
  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        className={
          collapsed
            ? "w-full flex items-center justify-center px-3 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            : "w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        }
        title={label}
        aria-label={label}
      >
        <IconComponent className="w-4 h-4" />
        {!collapsed && <span className={isIos ? "flex-1 text-left" : undefined}>{label}</span>}
        {!collapsed && isIos && (
          <span className="text-xs text-gray-400 dark:text-gray-500 select-none">手动</span>
        )}
      </button>

      {/* iOS 手动添加引导：轻量内嵌说明，不遮挡正文 */}
      {hintOpen && !collapsed && isIos && (
        <div className="mt-1 px-3 pb-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          在 Safari 中点击底部「<span className="font-medium">分享</span>」，再选择「
          <span className="font-medium">添加到主屏幕</span>」。
          <button
            onClick={(e) => {
              e.stopPropagation();
              setHintOpen(false);
            }}
            className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="关闭提示"
          >
            关闭
          </button>
        </div>
      )}
    </div>
  );
}
