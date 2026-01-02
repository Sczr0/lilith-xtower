'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

import { cx } from '../../components/ui/styles';
import { UnifiedApiDashboardHeader } from './UnifiedApiDashboardHeader';
import { UnifiedApiSidebar, type UnifiedApiSectionId } from './UnifiedApiSidebar';

interface UnifiedApiDashboardShellProps {
  activeSection?: UnifiedApiSectionId | null;
  onSectionChange?: (sectionId: UnifiedApiSectionId) => void;
  children: ReactNode;
  /**
   * 说明：传 null 表示不渲染 footer；不传则使用默认 footer。
   */
  footer?: ReactNode | null;
  mainClassName?: string;
  containerClassName?: string;
}

const DEFAULT_FOOTER_TEXT = '© 2025 Phigros Query. All Rights Reserved.';

export function UnifiedApiDashboardShell({
  activeSection,
  onSectionChange,
  children,
  footer,
  mainClassName,
  containerClassName,
}: UnifiedApiDashboardShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div
      className="flex h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950"
      style={{ height: '100dvh' }}
    >
      <UnifiedApiSidebar
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <UnifiedApiDashboardHeader onOpenMenu={() => setIsMobileMenuOpen(true)} />

        <main className={cx('flex-1 overflow-y-auto p-4 sm:p-6', mainClassName)}>
          <div className={cx('max-w-6xl mx-auto', containerClassName)}>
            {children}
          </div>
        </main>

        {footer !== null && (
          <footer className="border-t border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm flex items-center justify-center px-3 text-center py-3">
            {footer ?? <p className="text-sm text-gray-500 dark:text-gray-400">{DEFAULT_FOOTER_TEXT}</p>}
          </footer>
        )}
      </div>
    </div>
  );
}

