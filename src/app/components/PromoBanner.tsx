"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { promoBannerConfig } from "../config/promo-banner.config";
import {
  buildDismissKey,
  resolveAutoHideMs,
  selectActiveSlides,
} from "../utils/promoBanner";

/**
 * 顶部轮播活动横幅
 * - 支持多 slide 自动播放/手动切换
 * - 按配置决定哪些页面显示/隐藏
 * - 无操作时自动收起，手动关闭写入 localStorage，防止再次出现
 */
export function PromoBanner() {
  const pathname = usePathname() ?? "/";
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
  const textColor = slide.textColor ?? "text-white";

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

  return (
    <div className="sticky top-0 z-[70] mx-auto w-full">
      {/* 自动收起后的还原按钮 */}
      {collapsed && (
        <div className="flex justify-center px-3 pt-3">
          <button
            onClick={handleExpand}
            className="flex items-center gap-2 rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 px-4 py-2 shadow-lg border border-white/20 dark:border-black/10"
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
            className={`relative overflow-hidden rounded-2xl border border-white/15 dark:border-white/10 shadow-xl bg-gradient-to-r ${gradient} ${textColor}`}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            onFocus={() => setHovering(true)}
            onBlur={() => setHovering(false)}
            role={slide.href ? "button" : "region"}
            tabIndex={0}
            aria-label={`${slide.title}${slide.description ? "：" + slide.description : ""}`}
            onClick={handleClickSlide}
            onKeyDown={handleKeyDown}
          >
            <div className="absolute inset-0 bg-white/5 dark:bg-black/15 pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm uppercase tracking-wide bg-white/15 dark:bg-black/20 px-3 py-1 rounded-full">
                <span>站内活动</span>
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  {hasControls && (
                    <span className="inline-flex items-center justify-center text-[10px] sm:text-xs px-2 py-1 rounded-full bg-black/20 dark:bg-white/15">
                      {current + 1}/{slides.length}
                    </span>
                  )}
                  <p className="text-sm sm:text-base font-semibold leading-tight line-clamp-1">
                    {slide.title}
                  </p>
                </div>
                {slide.description && (
                  <p className="text-xs sm:text-sm opacity-90 leading-snug line-clamp-2">
                    {slide.description}
                  </p>
                )}
              </div>

              {slide.cta && (
                <span
                  className="inline-flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-white/90 text-neutral-900 hover:bg-white shadow-sm transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClickSlide();
                  }}
                >
                  {slide.cta}
                </span>
              )}

              <div className="flex items-center gap-2 sm:gap-3 ml-auto">
                {hasControls && (
                  <div className="flex items-center gap-1">
                    <button
                      className="p-1 rounded-full bg-white/15 hover:bg-white/25 transition"
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
                      className="p-1 rounded-full bg-white/15 hover:bg-white/25 transition"
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
                      className="p-1 rounded-full bg-white/15 hover:bg-white/25 transition"
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
                  className="p-1 rounded-full bg-white/15 hover:bg-white/25 transition"
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
