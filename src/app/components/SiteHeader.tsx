'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';

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

  const handleClose = () => setIsMobileMenuOpen(false);

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
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label={isMobileMenuOpen ? '关闭菜单' : '打开菜单'}
            aria-expanded={isMobileMenuOpen}
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
        </Dialog.Trigger>
      )}
    </div>
  );

  return (
    <Dialog.Root open={enableMobileMenu ? isMobileMenuOpen : false} onOpenChange={setIsMobileMenuOpen}>
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

      {/* 移动端下拉菜单：使用 Radix Dialog 获取 focus trap 与滚动锁定 */}
      {enableMobileMenu && (
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/20 z-30 md:hidden" />
          <Dialog.Content className="fixed top-14 left-0 right-0 z-40 bg-white dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-800 shadow-lg md:hidden">
            <Dialog.Title className="sr-only">站点菜单</Dialog.Title>
            <Dialog.Description className="sr-only">站点导航与账户操作</Dialog.Description>

            <nav>
              <div className="px-4 py-3 space-y-1">
                {links.map((item) => (
                  <TopBarLink
                    key={item.href}
                    item={item}
                    onClick={handleClose}
                    className="block px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-neutral-800 transition-colors"
                  />
                ))}
                {showLogin && !isAuthenticated && (
                  <Link
                    href="/login"
                    onClick={handleClose}
                    className="block px-3 py-2.5 rounded-lg text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    登录
                  </Link>
                )}
                {showLogout && isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      logout();
                    }}
                    className="w-full text-left block px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 transition-colors"
                  >
                    退出登录
                  </button>
                )}
              </div>
            </nav>
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  );
}
