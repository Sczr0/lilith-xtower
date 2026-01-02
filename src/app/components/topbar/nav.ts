export type NavItem = {
  href: string;
  label: string;
  /**
   * 说明：默认根据 href 自动判断是否外链；如需强制按外链处理，可显式设置 external=true。
   */
  external?: boolean;
};

/**
 * 判断是否为外部链接。
 * 说明：此函数为纯函数，便于在 vitest(node) 环境下做最小单测。
 */
export function isExternalHref(href: string): boolean {
  return (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('//') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  );
}

/**
 * 站点默认导航（用于站点页顶栏）。
 * 说明：导航项集中定义，避免各页面/各 Header 分散维护。
 */
export const SITE_NAV_ITEMS: NavItem[] = [
  { href: '/about', label: '关于' },
  { href: '/sponsors', label: '赞助者' },
  { href: '/qa', label: '常见问题' },
  { href: '/unified-api', label: '联合API接入' },
  { href: '/contribute', label: '投稿' },
  { href: '/dashboard', label: '仪表盘' },
];

/**
 * Dashboard 顶栏默认导航（用于 dashboard/unified-api 等后台壳）。
 * 说明：内容可与站点页不同，但样式应由同一套 TopBar 体系统一。
 */
export const DASHBOARD_NAV_ITEMS: NavItem[] = [
  { href: '/about', label: '关于' },
  { href: '/contribute', label: '投稿' },
  { href: '/unified-api', label: '联合API接入' },
  { href: '/debug-auth', label: '调试' },
];

