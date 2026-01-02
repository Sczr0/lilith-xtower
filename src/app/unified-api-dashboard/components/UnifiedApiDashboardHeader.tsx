'use client';

import Link from 'next/link';

import { ThemeToggle } from '../../components/ThemeToggle';
import { TopBar } from '../../components/topbar/TopBar';
import { TopBarLink } from '../../components/topbar/TopBarLink';
import { UNIFIED_API_DASHBOARD_NAV_ITEMS } from '../../components/topbar/nav';
import { cx } from '../../components/ui/styles';
import { useAuth } from '../../contexts/AuthContext';

interface UnifiedApiDashboardHeaderProps {
  onOpenMenu?: () => void;
}

export function UnifiedApiDashboardHeader({ onOpenMenu }: UnifiedApiDashboardHeaderProps) {
  const { logout, credential } = useAuth();

  const getCredentialDisplay = () => {
    if (!credential) return '未知用户';

    switch (credential.type) {
      case 'session':
        return 'SessionToken 登录';
      case 'api':
        return 'API 凭证登录';
      case 'platform':
        return `${credential.platform} 平台`;
      default:
        return '已登录';
    }
  };

  const logoutButtonClassName =
    'text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors';

  return (
    <TopBar
      sticky={false}
      left={
        <>
          {onOpenMenu && (
            <button
              type="button"
              onClick={onOpenMenu}
              className="lg:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="打开菜单"
              title="菜单"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <Link href="/unified-api-dashboard" className="text-base font-semibold text-gray-900 dark:text-gray-50 whitespace-nowrap">
            联合API
          </Link>
        </>
      }
      right={
        <div className="flex items-center gap-2 lg:gap-4">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-neutral-900 rounded-lg">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="8" />
            </svg>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {getCredentialDisplay()}
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-4">
            {UNIFIED_API_DASHBOARD_NAV_ITEMS.map((item) => (
              <TopBarLink key={item.href} item={item} />
            ))}
          </nav>

          <button type="button" onClick={logout} className={cx('hidden lg:block', logoutButtonClassName)}>
            退出登录
          </button>

          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
        </div>
      }
    />
  );
}
