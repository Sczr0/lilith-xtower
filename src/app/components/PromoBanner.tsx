"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, PlayCircle, X } from "lucide-react";
import { promoBannerConfig } from "../config/promo-banner.config";
import {
  buildDismissKey,
  filterSlidesByDismissState,
  resolvePromoBannerAppearance,
  resolvePromoBannerSlideAppearance,
  type PromoBannerSlide,
  selectActiveSlides,
} from "../utils/promoBanner";
import { useClientValue } from "../hooks/useClientValue";
import { buildGoHref } from "../utils/outbound";

const AUTO_SCROLL_SPEED_PX_PER_SEC = 580;

/**
 * 顶部细条活动横幅
 * - 使用“轻量文本公告”样式，减少视觉负担
 * - 按配置筛选当前路径可见的活动
 * - 手动关闭会写入 localStorage，防止同活动重复打扰
 */
export function PromoBanner({ pathname }: { pathname: string }) {
  const dismissKey = buildDismissKey(promoBannerConfig);
  const defaultAppearance = resolvePromoBannerAppearance(promoBannerConfig.appearance);
  const slides = useMemo(() => selectActiveSlides(promoBannerConfig, pathname), [pathname]);

  // 说明：首帧先按“已关闭”处理，避免被 localStorage 中的关闭状态反向闪烁。
  const dismissedByStorage = useClientValue(
    () => window.localStorage.getItem(dismissKey) === "1",
    true,
  );
  const [dismissedByUser, setDismissedByUser] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const marqueeGroupRef = useRef<HTMLDivElement | null>(null);
  const loopWidthRef = useRef(0);
  const isPointerDownRef = useRef(false);
  const pauseUntilRef = useRef(0);
  const isProgrammaticScrollRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastFrameTsRef = useRef<number | null>(null);
  const [canLoop, setCanLoop] = useState(false);

  const visibleSlides = useMemo(
    () => filterSlidesByDismissState(slides, dismissedByStorage),
    [slides, dismissedByStorage],
  );

  const bannerAppearance = useMemo(() => {
    if (visibleSlides.length !== 1) return defaultAppearance;
    return resolvePromoBannerSlideAppearance(
      promoBannerConfig.appearance,
      visibleSlides[0]?.appearance,
    );
  }, [defaultAppearance, visibleSlides]);

  const dismissed = dismissedByUser;

  const pauseAutoScroll = useCallback((durationMs = 2000) => {
    pauseUntilRef.current = Math.max(pauseUntilRef.current, Date.now() + durationMs);
  }, []);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const marqueeGroup = marqueeGroupRef.current;
    if (!scrollContainer || !marqueeGroup) return;

    const updateLoopMetrics = () => {
      const baseWidth = marqueeGroup.scrollWidth;
      const shouldLoop = baseWidth > scrollContainer.clientWidth + 2;
      setCanLoop((prev) => (prev === shouldLoop ? prev : shouldLoop));
      loopWidthRef.current = shouldLoop ? baseWidth : 0;

      if (!shouldLoop) {
        isProgrammaticScrollRef.current = true;
        try {
          scrollContainer.scrollLeft = 0;
        } finally {
          isProgrammaticScrollRef.current = false;
        }
        return;
      }

      if (scrollContainer.scrollLeft >= baseWidth) {
        isProgrammaticScrollRef.current = true;
        try {
          scrollContainer.scrollLeft = scrollContainer.scrollLeft % baseWidth;
        } finally {
          isProgrammaticScrollRef.current = false;
        }
      }
    };

    updateLoopMetrics();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateLoopMetrics) : null;
    resizeObserver?.observe(scrollContainer);
    resizeObserver?.observe(marqueeGroup);
    window.addEventListener("resize", updateLoopMetrics);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateLoopMetrics);
    };
  }, [visibleSlides.length]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || !canLoop) return;

    lastFrameTsRef.current = null;
    const step = (timestamp: number) => {
      if (lastFrameTsRef.current == null) {
        lastFrameTsRef.current = timestamp;
        rafRef.current = window.requestAnimationFrame(step);
        return;
      }

      const dt = Math.min((timestamp - lastFrameTsRef.current) / 1000, 0.05);
      lastFrameTsRef.current = timestamp;

      if (!isPointerDownRef.current && Date.now() >= pauseUntilRef.current) {
        const loopWidth = loopWidthRef.current;
        if (loopWidth > 1) {
          let next = scrollContainer.scrollLeft + AUTO_SCROLL_SPEED_PX_PER_SEC * dt;
          if (next >= loopWidth) {
            next -= loopWidth;
          }

          isProgrammaticScrollRef.current = true;
          try {
            scrollContainer.scrollLeft = next;
          } finally {
            isProgrammaticScrollRef.current = false;
          }
        }
      }

      rafRef.current = window.requestAnimationFrame(step);
    };

    rafRef.current = window.requestAnimationFrame(step);

    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastFrameTsRef.current = null;
    };
  }, [canLoop]);

  if (dismissed) return null;
  if (visibleSlides.length === 0) return null;

  const handleDismiss = () => {
    setDismissedByUser(true);
    try {
      window.localStorage.setItem(dismissKey, "1");
    } catch {}
  };

  const resolveSlideAction = (
    slide: PromoBannerSlide,
  ): { href: string; openInNewTab: boolean } | null => {
    if (!slide.href) return null;
    const goHref = buildGoHref(slide.href);
    if (goHref) {
      return { href: goHref, openInNewTab: true };
    }
    return { href: slide.href, openInNewTab: !!slide.newTab };
  };

  const bannerStyle = {
    "--promo-banner-bg": bannerAppearance.backgroundColor,
    "--promo-banner-border": bannerAppearance.borderColor,
    "--promo-banner-text": bannerAppearance.textColor,
    "--promo-banner-muted": bannerAppearance.mutedTextColor,
    "--promo-banner-icon-bg": bannerAppearance.iconBackgroundColor,
    "--promo-banner-icon": bannerAppearance.iconColor,
    "--promo-banner-link-hover": bannerAppearance.linkHoverColor,
  } as CSSProperties;

  return (
    <div
      style={bannerStyle}
      className="w-full border-b border-[color:var(--promo-banner-border)] bg-[color:var(--promo-banner-bg)] text-[color:var(--promo-banner-text)] backdrop-blur-md"
    >
      <div className="flex h-10 items-center gap-3 px-4 lg:px-6">
        <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--promo-banner-icon-bg)] text-[color:var(--promo-banner-icon)]">
          <PlayCircle className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
        </span>

        <div
          ref={scrollContainerRef}
          className="hide-scrollbar min-w-0 flex-1 overflow-x-auto"
          onPointerDown={() => {
            isPointerDownRef.current = true;
            pauseAutoScroll(2500);
          }}
          onPointerUp={() => {
            isPointerDownRef.current = false;
            pauseAutoScroll(1600);
          }}
          onPointerCancel={() => {
            isPointerDownRef.current = false;
            pauseAutoScroll(1600);
          }}
          onWheel={() => pauseAutoScroll(2000)}
          onTouchStart={() => pauseAutoScroll(2200)}
          onScroll={() => {
            if (isProgrammaticScrollRef.current) return;
            const scrollContainer = scrollContainerRef.current;
            const loopWidth = loopWidthRef.current;
            if (scrollContainer && loopWidth > 1 && scrollContainer.scrollLeft >= loopWidth) {
              isProgrammaticScrollRef.current = true;
              try {
                scrollContainer.scrollLeft = scrollContainer.scrollLeft % loopWidth;
              } finally {
                isProgrammaticScrollRef.current = false;
              }
            }
            pauseAutoScroll(1600);
          }}
        >
          <div className="flex w-max items-center gap-0 whitespace-nowrap text-xs sm:text-sm">
            <div ref={marqueeGroupRef} className="flex items-center gap-2 pr-8">
              {visibleSlides.map((slide, index) => {
                const action = resolveSlideAction(slide);
                const slideAppearance = resolvePromoBannerSlideAppearance(
                  promoBannerConfig.appearance,
                  slide.appearance,
                );
                const slideStyle = {
                  "--promo-slide-text": slideAppearance.textColor,
                  "--promo-slide-link-hover": slideAppearance.linkHoverColor,
                } as CSSProperties;
                return (
                  <div key={`primary-${slide.id}`} className="inline-flex items-center gap-2">
                    {index > 0 ? <span className="text-[color:var(--promo-banner-muted)]">|</span> : null}
                    {action ? (
                      <a
                        style={slideStyle}
                        href={action.href}
                        target={action.openInNewTab ? "_blank" : undefined}
                        rel={action.openInNewTab ? "noopener noreferrer" : undefined}
                        referrerPolicy={action.openInNewTab ? "no-referrer" : undefined}
                        className="inline-flex items-center gap-1.5 text-[color:var(--promo-slide-text)] transition-colors hover:text-[color:var(--promo-slide-link-hover)]"
                        aria-label={slide.description ? `${slide.title}：${slide.description}` : slide.title}
                      >
                        <span>{slide.title}</span>
                        {action.openInNewTab ? (
                          <ExternalLink className="h-3 w-3 opacity-60" aria-hidden="true" />
                        ) : null}
                      </a>
                    ) : (
                      <span style={slideStyle} className="text-[color:var(--promo-slide-text)]">
                        {slide.title}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {canLoop ? (
              <div aria-hidden="true" className="flex items-center gap-2 pr-8">
                {visibleSlides.map((slide, index) => {
                  const action = resolveSlideAction(slide);
                  const slideAppearance = resolvePromoBannerSlideAppearance(
                    promoBannerConfig.appearance,
                    slide.appearance,
                  );
                  const slideStyle = {
                    "--promo-slide-text": slideAppearance.textColor,
                    "--promo-slide-link-hover": slideAppearance.linkHoverColor,
                  } as CSSProperties;
                  return (
                    <div key={`clone-${slide.id}`} className="inline-flex items-center gap-2">
                      {index > 0 ? <span className="text-[color:var(--promo-banner-muted)]">|</span> : null}
                      {action ? (
                        <a
                          style={slideStyle}
                          href={action.href}
                          target={action.openInNewTab ? "_blank" : undefined}
                          rel={action.openInNewTab ? "noopener noreferrer" : undefined}
                          referrerPolicy={action.openInNewTab ? "no-referrer" : undefined}
                          className="inline-flex items-center gap-1.5 text-[color:var(--promo-slide-text)] transition-colors hover:text-[color:var(--promo-slide-link-hover)]"
                        >
                          <span>{slide.title}</span>
                          {action.openInNewTab ? (
                            <ExternalLink className="h-3 w-3 opacity-60" aria-hidden="true" />
                          ) : null}
                        </a>
                      ) : (
                        <span style={slideStyle} className="text-[color:var(--promo-slide-text)]">
                          {slide.title}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          className="flex-shrink-0 rounded-md p-1 text-[color:var(--promo-banner-muted)] transition-colors hover:bg-black/5 hover:text-[color:var(--promo-banner-text)]"
          onClick={handleDismiss}
          aria-label="关闭活动横幅"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
