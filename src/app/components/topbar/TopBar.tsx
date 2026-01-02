'use client';

import type { ReactNode } from 'react';

import { cx } from '../ui/styles';

export const TOP_BAR_BASE_CLASSNAME =
  'h-14 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 lg:px-6 flex items-center gap-3';

interface TopBarProps {
  sticky?: boolean;
  className?: string;
  left: ReactNode;
  right?: ReactNode;
  rightClassName?: string;
}

/**
 * 顶栏基础容器（统一高度/背景/边框/间距/布局）。
 * 说明：仅负责“外壳”，不绑定具体导航/认证/菜单逻辑；上层组件通过 left/right 插槽扩展。
 */
export function TopBar({ sticky = true, className, left, right, rightClassName }: TopBarProps) {
  return (
    <header className={cx(sticky && 'sticky top-0 z-40', TOP_BAR_BASE_CLASSNAME, className)}>
      <div className="flex items-center gap-3 min-w-0">
        {left}
      </div>
      {right && (
        <div className={cx('ml-auto flex items-center', rightClassName)}>
          {right}
        </div>
      )}
    </header>
  );
}

