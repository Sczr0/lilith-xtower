import { describe, expect, it } from 'vitest';

import {
  DASHBOARD_NAV_ITEMS,
  SITE_NAV_ITEMS,
  UNIFIED_API_DASHBOARD_NAV_ITEMS,
  buildSiteNavItems,
  isExternalHref,
} from './nav';

describe('topbar/nav', () => {
  it('isExternalHref: 识别常见外链协议', () => {
    expect(isExternalHref('https://example.com')).toBe(true);
    expect(isExternalHref('http://example.com')).toBe(true);
    expect(isExternalHref('//example.com')).toBe(true);
    expect(isExternalHref('mailto:test@example.com')).toBe(true);
    expect(isExternalHref('tel:+10086')).toBe(true);
  });

  it('isExternalHref: 识别站内路径为非外链', () => {
    expect(isExternalHref('/about')).toBe(false);
    expect(isExternalHref('/dashboard')).toBe(false);
    expect(isExternalHref('#hash')).toBe(false);
    expect(isExternalHref('relative/path')).toBe(false);
  });

  it('默认导航配置应包含核心入口', () => {
    expect(SITE_NAV_ITEMS.length).toBeGreaterThan(0);
    expect(SITE_NAV_ITEMS.some((item) => item.href === '/dashboard')).toBe(true);
    // 灰度默认关闭“开放平台”Header入口
    expect(SITE_NAV_ITEMS.some((item) => item.href === '/open-platform')).toBe(false);
    expect(SITE_NAV_ITEMS.some((item) => item.href === '/unified-api-dashboard')).toBe(false);
    expect(DASHBOARD_NAV_ITEMS.some((item) => item.href === '/unified-api-dashboard')).toBe(false);
    expect(UNIFIED_API_DASHBOARD_NAV_ITEMS.some((item) => item.href === '/dashboard')).toBe(true);
  });

  it('buildSiteNavItems: 支持灰度开关控制开放平台入口', () => {
    const hiddenItems = buildSiteNavItems(false);
    const shownItems = buildSiteNavItems(true);

    expect(hiddenItems.some((item) => item.href === '/open-platform')).toBe(false);
    expect(shownItems.some((item) => item.href === '/open-platform')).toBe(true);
  });
});
