import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROMO_BANNER_APPEARANCE,
  filterSlidesByDismissState,
  matchPath,
  isWithinTimeWindow,
  isSlideActive,
  resolvePromoBannerAppearance,
  resolvePromoBannerSlideAppearance,
  selectActiveSlides,
  resolveAutoHideMs,
  type PromoBannerConfig,
  type PromoBannerSlide,
} from "../promoBanner";

const baseSlide: PromoBannerSlide = {
  id: "s1",
  title: "test",
};

const baseConfig: PromoBannerConfig = {
  enabled: true,
  campaignId: "test",
  include: ["*"],
  exclude: ["/login"],
  autoCollapseMs: 8000,
  slides: [baseSlide],
};

describe("matchPath", () => {
  it("supports wildcard and prefix patterns", () => {
    expect(matchPath("/dashboard/abc", ["*"])).toBe(true);
    expect(matchPath("/dashboard/abc", ["/dashboard/*"])).toBe(true);
    expect(matchPath("/dashboard/abc", ["/dashboard"])).toBe(false);
    expect(matchPath("/qa", ["/dashboard/*", "/qa"])).toBe(true);
  });
});

describe("isWithinTimeWindow", () => {
  it("returns false before start and after end", () => {
    const slide: PromoBannerSlide = {
      ...baseSlide,
      startAt: "2025-01-10T00:00:00Z",
      endAt: "2025-01-20T00:00:00Z",
    };
    expect(isWithinTimeWindow(slide, new Date("2025-01-05T00:00:00Z"))).toBe(false);
    expect(isWithinTimeWindow(slide, new Date("2025-01-25T00:00:00Z"))).toBe(false);
    expect(isWithinTimeWindow(slide, new Date("2025-01-15T00:00:00Z"))).toBe(true);
  });
});

describe("isSlideActive / selectActiveSlides", () => {
  it("honors include and exclude rules", () => {
    const cfg: PromoBannerConfig = {
      ...baseConfig,
      slides: [
        {
          ...baseSlide,
          id: "route-filter",
          showOn: ["/dashboard/*"],
          hideOn: ["/dashboard/hidden"],
        },
      ],
    };
    expect(isSlideActive(cfg.slides[0], cfg, "/dashboard/home", new Date())).toBe(true);
    expect(isSlideActive(cfg.slides[0], cfg, "/dashboard/hidden", new Date())).toBe(false);
    expect(selectActiveSlides(cfg, "/login", new Date()).length).toBe(0);
  });

  it("respects enabled flag and time window", () => {
    const cfg: PromoBannerConfig = {
      ...baseConfig,
      enabled: false,
      slides: [
        {
          ...baseSlide,
          id: "time",
          startAt: "2030-01-01T00:00:00Z",
        },
      ],
    };
    expect(selectActiveSlides(cfg, "/", new Date())).toEqual([]);
  });
});

describe("resolveAutoHideMs", () => {
  it("prefers slide override over global", () => {
    const slide = { ...baseSlide, autoHideAfterMs: 15000 };
    expect(resolveAutoHideMs(slide, baseConfig)).toBe(15000);
    expect(resolveAutoHideMs(baseSlide, baseConfig)).toBe(baseConfig.autoCollapseMs);
  });
});

describe("filterSlidesByDismissState", () => {
  it("keeps all slides when not dismissed", () => {
    const slides: PromoBannerSlide[] = [
      { id: "normal", title: "normal" },
      { id: "always", title: "always", ignoreDismiss: true },
    ];
    expect(filterSlidesByDismissState(slides, false)).toEqual(slides);
  });

  it("keeps only ignoreDismiss slides when dismissed", () => {
    const slides: PromoBannerSlide[] = [
      { id: "normal", title: "normal" },
      { id: "always", title: "always", ignoreDismiss: true },
    ];
    expect(filterSlidesByDismissState(slides, true)).toEqual([
      { id: "always", title: "always", ignoreDismiss: true },
    ]);
  });
});

describe("resolvePromoBannerAppearance", () => {
  it("returns defaults when appearance is undefined", () => {
    expect(resolvePromoBannerAppearance(undefined)).toEqual(DEFAULT_PROMO_BANNER_APPEARANCE);
  });

  it("merges custom colors on top of defaults", () => {
    const merged = resolvePromoBannerAppearance({
      backgroundColor: "#111111",
      textColor: "#eeeeee",
    });
    expect(merged.backgroundColor).toBe("#111111");
    expect(merged.textColor).toBe("#eeeeee");
    expect(merged.borderColor).toBe(DEFAULT_PROMO_BANNER_APPEARANCE.borderColor);
  });
});

describe("resolvePromoBannerSlideAppearance", () => {
  it("allows slide appearance to override global appearance", () => {
    const merged = resolvePromoBannerSlideAppearance(
      {
        backgroundColor: "#f6f1ea",
        textColor: "#374151",
      },
      {
        textColor: "#111111",
        linkHoverColor: "#000000",
      },
    );
    expect(merged.backgroundColor).toBe("#f6f1ea");
    expect(merged.textColor).toBe("#111111");
    expect(merged.linkHoverColor).toBe("#000000");
  });
});
