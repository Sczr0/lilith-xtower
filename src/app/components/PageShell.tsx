import type { ReactNode } from 'react';

import { SiteFooter, type SiteFooterVariant } from './SiteFooter';
import { cx } from './ui/styles';

export type PageShellVariant = 'plain' | 'gradient';

interface PageShellProps {
  variant?: PageShellVariant;
  header?: ReactNode;
  children: ReactNode;
  footerVariant?: SiteFooterVariant;
  footerText?: string;
  beforeMain?: ReactNode;
  afterMain?: ReactNode;
  main?: boolean;
  mainClassName?: string;
  containerClassName?: string;
  className?: string;
}

const DEFAULT_FOOTER_TEXT = '© 2025 Phigros Query. All Rights Reserved.';

/**
 * 站点级页面骨架（背景/文字色/标准容器/统一 Footer）
 * - 通过 variant 统一“纯色页”和“渐变页”的视觉底色
 * - 通过 main=false 支持像 AgreementContent 这种自带 main 的页面
 */
export function PageShell({
  variant = 'plain',
  header,
  children,
  footerVariant = 'links',
  footerText = DEFAULT_FOOTER_TEXT,
  beforeMain,
  afterMain,
  main = true,
  mainClassName,
  containerClassName,
  className,
}: PageShellProps) {
  const surfaceClassName =
    variant === 'gradient'
      ? 'bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-neutral-950 dark:via-neutral-950 dark:to-blue-950'
      : 'bg-white dark:bg-neutral-950';
  const mainBaseClassName = mainClassName ? '' : 'px-4 py-10 sm:py-14';
  const containerBaseClassName = containerClassName ? '' : 'mx-auto max-w-4xl';

  if (!main) {
    return (
      <div className={cx('min-h-screen text-gray-900 dark:text-gray-50', surfaceClassName, className)}>
        {beforeMain}
        {header}
        {children}
        {afterMain}
      </div>
    );
  }

  return (
    <div className={cx('min-h-screen text-gray-900 dark:text-gray-50', surfaceClassName, className)}>
      {beforeMain}
      {header}
      <main className={cx(mainBaseClassName, mainClassName)}>
        <div className={cx(containerBaseClassName, containerClassName)}>
          {children}
          {footerVariant !== 'none' && <SiteFooter variant={footerVariant} text={footerText} />}
        </div>
      </main>
      {afterMain}
    </div>
  );
}
