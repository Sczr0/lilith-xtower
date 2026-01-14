'use client';

import { cx } from '../../components/ui/styles';
import type { UnifiedApiSectionId } from './UnifiedApiSidebar';

interface UnifiedApiMobileTabsProps {
  activeSection: UnifiedApiSectionId;
  onSectionChange: (sectionId: UnifiedApiSectionId) => void;
}

export function UnifiedApiMobileTabs({ activeSection, onSectionChange }: UnifiedApiMobileTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 lg:hidden">
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-gray-200/70 dark:border-neutral-800/70 bg-white/70 dark:bg-gray-800/60 backdrop-blur-md p-1">
        <button
          type="button"
          className={cx(
            'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            activeSection === 'bind'
              ? 'bg-blue-600 text-white shadow'
              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-gray-700/50',
          )}
          onClick={() => onSectionChange('bind')}
        >
          绑定
        </button>
        <button
          type="button"
          className={cx(
            'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            activeSection === 'accounts'
              ? 'bg-blue-600 text-white shadow'
              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-gray-700/50',
          )}
          onClick={() => onSectionChange('accounts')}
        >
          账号
        </button>
        <button
          type="button"
          className={cx(
            'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            activeSection === 'tools'
              ? 'bg-blue-600 text-white shadow'
              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-gray-700/50',
          )}
          onClick={() => onSectionChange('tools')}
        >
          查询工具
        </button>
      </div>
    </div>
  );
}

