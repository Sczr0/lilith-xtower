"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { promoBannerConfig } from "../config/promo-banner.config";
import {
  buildDismissKey,
  resolveAutoHideMs,
  selectActiveSlides,
} from "../utils/promoBanner";
import { isExternalHref } from "./topbar/nav";

/**
 * 顶部轮播活动横幅
 * - 支持多 slide 自动播放/手动切换
 * - 按配置决定哪些页面显示/隐藏
 * - 无操作时自动收起，手动关闭写入 localStorage，防止再次出现
 */
export function PromoBanner() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const dismissKey = buildDismissKey(promoBannerConfig);

  const slides = useMemo(() => selectActiveSlides(promoBannerConfig, pathname), [pathname]);

  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const autoHideTimer = useRef<NodeJS.Timeout | null>(null);
  const autoPlayTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => setMounted(true), []);

  // 初始化 dismiss 状态，监听 campaign 变化
  useEffect(() => {
    if (!mounted) return;
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(dismissKey) : null;
    setDismissed(stored === "1");
    setCollapsed(false);
  }, [mounted, dismissKey, pathname]);

  // 路由变化时回到第一条
  useEffect(() => {
    setCurrent(0);
    setCollapsed(false);
  }, [pathname, slides.length]);

  // 自动播放
  useEffect(() => {
    if (!mounted || dismissed || collapsed) return;
    if (slides.length <= 1) return;
    if (hovering || paused) return;

    const ms = promoBannerConfig.autoAdvanceMs ?? 5200;
    if (autoPlayTimer.current) clearInterval(autoPlayTimer.current);
    autoPlayTimer.current = setInterval(() => {
      setCurrent((idx) => (idx + 1) % slides.length);
    }, ms);

    return () => {
      if (autoPlayTimer.current) clearInterval(autoPlayTimer.current);
    };
  }, [mounted, dismissed, collapsed, hovering, paused, slides.length]);

  // 自动收起
  useEffect(() => {
    if (!mounted || dismissed || collapsed) return;
    if (hovering) return;
    if (!slides[current]) return;

    const ms = resolveAutoHideMs(slides[current], promoBannerConfig);
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    autoHideTimer.current = setTimeout(() => setCollapsed(true), ms);

    return () => {
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    };
  }, [mounted, dismissed, collapsed, hovering, current, slides]);

  if (!mounted) return null;
  if (dismissed) return null;
  if (slides.length === 0) return null;

  const slide = slides[current] ?? slides[0];
  const gradient = slide.gradient ?? "from-slate-900 via-slate-800 to-slate-700";

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(dismissKey, "1");
    } catch {}
  };

  const handleExpand = () => setCollapsed(false);

  const handleClickSlide = () => {
    if (!slide.href) return;
    if (slide.newTab) {
      window.open(slide.href, "_blank", "noopener,noreferrer");
      return;
    }

    // 导航一致性：站内路径使用 Next Router 软导航，避免整页刷新。
    if (!isExternalHref(slide.href) && slide.href.startsWith("/")) {
      router.push(slide.href);
      return;
    } else {
      window.location.assign(slide.href);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!slide.href) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClickSlide();
    }
  };

  const hasControls = slides.length > 1;
  const isClickable = !!slide.href;

  return (
    <div className="sticky top-0 z-[70] mx-auto w-full">
      {/* 自动收起后的还原按钮 */}
      {collapsed && (
        <div className="flex justify-center px-3 pt-3">
          <button
            onClick={handleExpand}
            className="flex items-center gap-2 rounded-full bg-white/80 dark:bg-neutral-900/70 text-gray-900 dark:text-gray-100 px-4 py-2 shadow-lg border border-gray-200/60 dark:border-neutral-800/60 backdrop-blur-md hover:bg-white dark:hover:bg-neutral-900 transition-colors"
            aria-label="重新显示活动横幅"
          >
            <Play className="h-4 w-4" />
            <span className="text-sm">恢复活动信息</span>
          </button>
        </div>
      )}

      <div
        className={`transition-[max-height,opacity] duration-500 ease-in-out ${collapsed ? "max-h-0 opacity-0 pointer-events-none" : "max-h-40 opacity-100"}`}
        aria-hidden={collapsed}
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-4">
          <div
            className={`relative overflow-hidden rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-lg bg-white/75 dark:bg-gray-800/70 backdrop-blur-md text-gray-900 dark:text-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950 ${isClickable ? "cursor-pointer hover:border-blue-300/80 dark:hover:border-blue-700/60" : ""}`}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            onFocus={() => setHovering(true)}
            onBlur={() => setHovering(false)}
            role={isClickable ? "button" : "region"}
            tabIndex={isClickable ? 0 : -1}
            aria-label={`${slide.title}${slide.description ? "：" + slide.description : ""}`}
            onClick={handleClickSlide}
            onKeyDown={handleKeyDown}
          >
            {/* 左侧强调色：沿用 slide.gradient（默认会配置为蓝紫渐变） */}
            <div className={`absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b ${gradient} opacity-90 pointer-events-none`} />
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm uppercase tracking-wide bg-gray-100/80 dark:bg-neutral-900/50 px-3 py-1 rounded-full border border-gray-200/60 dark:border-neutral-700/60 text-gray-700 dark:text-gray-200">
                <span>站内活动</span>
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  {hasControls && (
                    <span className="inline-flex items-center justify-center text-[10px] sm:text-xs px-2 py-1 rounded-full bg-gray-100/80 dark:bg-neutral-900/50 border border-gray-200/60 dark:border-neutral-700/60 text-gray-600 dark:text-gray-300">
                      {current + 1}/{slides.length}
                    </span>
                  )}
                  <p className="text-sm sm:text-base font-semibold leading-tight line-clamp-1">
                    {slide.title}
                  </p>
                </div>
                {slide.description && (
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-snug line-clamp-2">
                    {slide.description}
                  </p>
                )}
              </div>

              {slide.cta && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClickSlide();
                  }}
                >
                  {slide.cta}
                </button>
              )}

              <div className="flex items-center gap-2 sm:gap-3 ml-auto">
                {hasControls && (
                  <div className="flex items-center gap-1">
                    <button
                      className="p-1 rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 transition-colors dark:bg-neutral-900/50 dark:hover:bg-neutral-900/70 dark:text-gray-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrent((idx) => (idx - 1 + slides.length) % slides.length);
                        setCollapsed(false);
                      }}
                      aria-label="上一条活动"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      className="p-1 rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 transition-colors dark:bg-neutral-900/50 dark:hover:bg-neutral-900/70 dark:text-gray-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPaused((p) => !p);
                      }}
                      aria-pressed={paused}
                      aria-label={paused ? "继续轮播" : "暂停轮播"}
                    >
                      {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </button>
                    <button
                      className="p-1 rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 transition-colors dark:bg-neutral-900/50 dark:hover:bg-neutral-900/70 dark:text-gray-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrent((idx) => (idx + 1) % slides.length);
                        setCollapsed(false);
                      }}
                      aria-label="下一条活动"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <button
                  className="p-1 rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 transition-colors dark:bg-neutral-900/50 dark:hover:bg-neutral-900/70 dark:text-gray-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss();
                  }}
                  aria-label="关闭活动横幅"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
