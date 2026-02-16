export interface PromoBannerSlide {
  id: string;
  title: string;
  description?: string;
  href?: string;
  cta?: string;
  gradient?: string;
  textColor?: string;
  startAt?: string;
  endAt?: string;
  showOn?: string[];
  hideOn?: string[];
  autoHideAfterMs?: number;
  newTab?: boolean;
  /**
   * 关闭横幅后，下一次访问依旧展示该条公告。
   * - true: 忽略 localStorage 的关闭记忆，始终可见（仍受时间/路径规则约束）
   * - false/undefined: 遵循默认关闭记忆逻辑
   */
  ignoreDismiss?: boolean;
  /**
   * 单条公告外观配置。
   * - 用于覆盖全局 appearance 的默认颜色。
   */
  appearance?: PromoBannerAppearance;
}

export interface PromoBannerAppearance {
  /**
   * 横幅背景色
   * 示例：#f6f1ea / rgba(246, 241, 234, 0.95)
   */
  backgroundColor?: string;
  /**
   * 横幅边框色
   */
  borderColor?: string;
  /**
   * 主文本色（标题、链接默认色）
   */
  textColor?: string;
  /**
   * 次文本色（分隔符、关闭按钮默认色）
   */
  mutedTextColor?: string;
  /**
   * 左侧图标底色
   */
  iconBackgroundColor?: string;
  /**
   * 左侧图标前景色
   */
  iconColor?: string;
  /**
   * 链接 hover 文本色
   */
  linkHoverColor?: string;
}

export interface PromoBannerConfig {
  enabled: boolean;
  campaignId: string;
  include?: string[];
  exclude?: string[];
  autoAdvanceMs?: number;
  autoCollapseMs?: number;
  appearance?: PromoBannerAppearance;
  slides: PromoBannerSlide[];
}

export const DEFAULT_PROMO_BANNER_APPEARANCE: Required<PromoBannerAppearance> = {
  backgroundColor: "rgba(246, 241, 234, 0.95)",
  borderColor: "rgba(253, 230, 138, 0.8)",
  textColor: "rgb(55, 65, 81)",
  mutedTextColor: "rgb(107, 114, 128)",
  iconBackgroundColor: "rgba(249, 115, 22, 0.15)",
  iconColor: "rgb(234, 88, 12)",
  linkHoverColor: "rgb(17, 24, 39)",
};

/**
 * 解析横幅外观配置（与默认值合并）。
 */
export function resolvePromoBannerAppearance(
  appearance?: PromoBannerAppearance
): Required<PromoBannerAppearance> {
  return {
    ...DEFAULT_PROMO_BANNER_APPEARANCE,
    ...(appearance ?? {}),
  };
}

/**
 * 解析“单条公告”的最终外观：
 * - 先使用全局 appearance（含默认值）
 * - 再用 slide.appearance 覆盖，实现“单条公告覆盖默认配置”
 */
export function resolvePromoBannerSlideAppearance(
  configAppearance?: PromoBannerAppearance,
  slideAppearance?: PromoBannerAppearance
): Required<PromoBannerAppearance> {
  return {
    ...resolvePromoBannerAppearance(configAppearance),
    ...(slideAppearance ?? {}),
  };
}

/**
 * 将路径名标准化为规范路径
 * 将 pathname 转换为以 "/" 开头的路径，移除后面的 query/hash
 */
export function normalizePath(pathname: string): string {
  if (!pathname) return "/";
  const trimmed = pathname.split(/[?#]/)[0] || "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * 匹配路径模式
 * - "*" 匹配所有路径
 * - "/path" 精确匹配该路径
 * - "/path/*" 匹配以该路径开头的所有路径
 */
export function matchPath(pathname: string, patterns?: string[]): boolean {
  if (!patterns || patterns.length === 0) return true;
  const path = normalizePath(pathname);
  return patterns.some((raw) => {
    if (!raw) return false;
    const pat = raw.startsWith("/") || raw === "*" ? raw : `/${raw}`;
    if (pat === "*") return true;
    if (pat.endsWith("*")) {
      const prefix = pat.slice(0, -1);
      return path.startsWith(prefix);
    }
    return path === pat;
  });
}

/**
 * 检查当前时间是否在幻灯片指定的时间窗口内
 * 如果 startAt/endAt 格式不正确，返回 true 以保持向后兼容性
 */
export function isWithinTimeWindow(slide: PromoBannerSlide, now: Date = new Date()): boolean {
  const start = slide.startAt ? new Date(slide.startAt) : null;
  const end = slide.endAt ? new Date(slide.endAt) : null;

  if (start && isNaN(start.getTime())) return true;
  if (end && isNaN(end.getTime())) return true;

  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

/**
 * 判断指定的 slide 是否在当前路径下应该显示
 */
export function isSlideActive(
  slide: PromoBannerSlide,
  config: PromoBannerConfig,
  pathname: string,
  now: Date = new Date()
): boolean {
  if (!isWithinTimeWindow(slide, now)) return false;

  const allowPatterns = slide.showOn && slide.showOn.length > 0 ? slide.showOn : config.include ?? ["*"];
  const blockPatterns = [...(config.exclude ?? []), ...(slide.hideOn ?? [])];

  if (!matchPath(pathname, allowPatterns)) return false;
  if (blockPatterns.length > 0 && matchPath(pathname, blockPatterns)) return false;
  return true;
}

/**
 * 根据配置和当前路径，返回需要显示的活跃的 slide 列表
 */
export function selectActiveSlides(
  config: PromoBannerConfig,
  pathname: string,
  now: Date = new Date()
): PromoBannerSlide[] {
  if (!config.enabled) return [];
  const path = normalizePath(pathname);
  return config.slides.filter((slide) => isSlideActive(slide, config, path, now));
}

/**
 * 构建用于 localStorage key 的 dismissed 状态，基于 campaignId 作为命名空间
 */
export function buildDismissKey(config: PromoBannerConfig): string {
  return `promo-banner:dismiss:${config.campaignId}`;
}

/**
 * 根据“本地关闭记忆”过滤可见 slide。
 * - 未关闭：返回全部活跃 slide。
 * - 已关闭：仅保留 ignoreDismiss=true 的 slide，支持“被叉掉后下次访问依旧显示”。
 */
export function filterSlidesByDismissState(
  slides: PromoBannerSlide[],
  dismissedByStorage: boolean
): PromoBannerSlide[] {
  if (!dismissedByStorage) return slides;
  return slides.filter((slide) => slide.ignoreDismiss === true);
}

/**
 * 解析自动隐藏时间，首先检查 slide 自己的 autoHideAfterMs，否则使用配置中的 autoCollapseMs
 */
export function resolveAutoHideMs(slide: PromoBannerSlide, config: PromoBannerConfig): number {
  return slide.autoHideAfterMs ?? config.autoCollapseMs ?? 12000;
}
