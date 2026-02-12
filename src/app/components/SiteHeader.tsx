'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../contexts/AuthContext';

import type { NavItem } from './topbar/nav';
import { SITE_NAV_ITEMS } from './topbar/nav';
import { TopBar } from './topbar/TopBar';
import { TopBarLink } from './topbar/TopBarLink';

interface SiteHeaderProps {
  /**
   * 说明：桌面端与移动端菜单的导航项（默认使用站点导航配置）。
   */
  links?: NavItem[];
  showLogin?: boolean;
  showLogout?: boolean;
  brandHref?: string;
  brandLabel?: string;
  sticky?: boolean;
  className?: string;
  /**
   * 说明：桌面端右侧额外区域（放在 ThemeToggle 之后）。
   */
  desktopActions?: ReactNode;
  /**
   * 说明：是否启用移动端汉堡菜单（某些页面可关闭）。
   */
  enableMobileMenu?: boolean;
}

const LOGIN_LINK_CLASSNAME =
  'text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors';

const LOGOUT_BUTTON_CLASSNAME =
  'text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors';

const MOBILE_MENU_DIALOG_ID = 'site-header-mobile-menu';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.hidden) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    return true;
  });
}

/**
 * 站点页统一顶栏：桌面端导航 + 移动端汉堡菜单 + 主题切换。
 * 说明：所有页面的顶栏差异应通过 props/config 表达，而不是继续新增页面专用 Header。
 */
export function SiteHeader({
  links = SITE_NAV_ITEMS,
  showLogin = true,
  showLogout = true,
  brandHref = '/',
  brandLabel = 'Phigros 查询',
  sticky = true,
  className,
  desktopActions,
  enableMobileMenu = true,
}: SiteHeaderProps) {
  const { isAuthenticated, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuDialogRef = useRef<HTMLDivElement | null>(null);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  useEffect(() => {
    // 轻量移动端菜单：手动补齐焦点陷阱与焦点恢复，保持可访问性体验。
    if (!isMobileMenuOpen || !enableMobileMenu) return;

    const dialog = mobileMenuDialogRef.current;
    const trigger = mobileMenuTriggerRef.current;
    const previousOverflow = document.body.style.overflow;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMobileMenu();
        return;
      }

      if (event.key !== 'Tab') return;
      if (!dialog) return;

      const focusable = getFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;
      const isOutsideDialog = !activeElement || !dialog.contains(activeElement);

      if (event.shiftKey) {
        if (isOutsideDialog || activeElement === first) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (isOutsideDialog || activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => {
      if (!dialog) return;
      const focusable = getFocusableElements(dialog);
      (focusable[0] ?? dialog).focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      if (trigger && document.contains(trigger)) {
        trigger.focus();
      }
    };
  }, [enableMobileMenu, isMobileMenuOpen]);

  const desktopNav = (
    <nav className="hidden md:flex items-center gap-4">
      {links.map((item) => (
        <TopBarLink key={item.href} item={item} />
      ))}
      {showLogin && !isAuthenticated && (
        <Link href="/login" className={LOGIN_LINK_CLASSNAME}>
          登录
        </Link>
      )}
      {showLogout && isAuthenticated && (
        <button type="button" onClick={logout} className={LOGOUT_BUTTON_CLASSNAME}>
          退出登录
        </button>
      )}
      <ThemeToggle />
      {desktopActions}
    </nav>
  );

  const mobileControls = (
    <div className="flex items-center gap-2 md:hidden">
      <ThemeToggle />
      {enableMobileMenu && (
        <button
          ref={mobileMenuTriggerRef}
          type="button"
          className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label={isMobileMenuOpen ? '关闭菜单' : '打开菜单'}
          aria-expanded={isMobileMenuOpen}
          aria-haspopup="dialog"
          aria-controls={MOBILE_MENU_DIALOG_ID}
          onClick={() => setIsMobileMenuOpen((value) => !value)}
        >
          {isMobileMenuOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      )}
    </div>
  );

  return (
    <>
      <TopBar
        sticky={sticky}
        className={className}
        left={
          <Link href={brandHref} className="text-base font-semibold text-gray-900 dark:text-gray-50 whitespace-nowrap">
            {brandLabel}
          </Link>
        }
        right={
          <>
            {desktopNav}
            {mobileControls}
          </>
        }
        rightClassName="gap-2"
      />

      {/* 移动端下拉菜单：轻量实现，避免首屏引入 Radix Dialog 相关依赖 */}
      {enableMobileMenu && isMobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={closeMobileMenu} aria-hidden="true" />
          <div
            id={MOBILE_MENU_DIALOG_ID}
            ref={mobileMenuDialogRef}
            className="fixed top-14 left-0 right-0 z-40 bg-white dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-800 shadow-lg md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="站点导航与账户操作"
            tabIndex={-1}
          >
            <nav>
              <div className="px-4 py-3 space-y-1">
                {links.map((item) => (
                  <TopBarLink
                    key={item.href}
                    item={item}
                    onClick={closeMobileMenu}
                    className="block px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-neutral-800 transition-colors"
                  />
                ))}
                {showLogin && !isAuthenticated && (
                  <Link
                    href="/login"
                    onClick={closeMobileMenu}
                    className="block px-3 py-2.5 rounded-lg text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    登录
                  </Link>
                )}
                {showLogout && isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => {
                      closeMobileMenu();
                      logout();
                    }}
                    className="w-full text-left block px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 transition-colors"
                  >
                    退出登录
                  </button>
                )}
              </div>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
