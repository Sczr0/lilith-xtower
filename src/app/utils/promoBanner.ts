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
}

export interface PromoBannerConfig {
  enabled: boolean;
  campaignId: string;
  include?: string[];
  exclude?: string[];
  autoAdvanceMs?: number;
  autoCollapseMs?: number;
  slides: PromoBannerSlide[];
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
 * 解析自动隐藏时间，首先检查 slide 自己的 autoHideAfterMs，否则使用配置中的 autoCollapseMs
 */
export function resolveAutoHideMs(slide: PromoBannerSlide, config: PromoBannerConfig): number {
  return slide.autoHideAfterMs ?? config.autoCollapseMs ?? 12000;
}
