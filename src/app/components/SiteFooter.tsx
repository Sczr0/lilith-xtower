import Link from 'next/link';

import { cx } from './ui/styles';

export type SiteFooterVariant = 'links' | 'rights' | 'none';

interface SiteFooterProps {
  variant?: SiteFooterVariant;
  text?: string;
  className?: string;
}

/**
 * 统一页脚
 * - links：展示协议/隐私链接
 * - rights：仅展示版权声明
 */
export function SiteFooter({ variant = 'links', text, className }: SiteFooterProps) {
  if (variant === 'none') return null;

  return (
    <footer
      className={cx(
        'pt-4 border-t border-gray-200 dark:border-neutral-800 text-sm text-gray-500 dark:text-gray-400',
        className,
      )}
    >
      {variant === 'links' ? (
        <>
          © 2025-2026 Phigros Query ·{' '}
          <Link href="/agreement" className="hover:text-blue-600 dark:hover:text-blue-400">
            用户协议
          </Link>{' '}
          ·{' '}
          <Link href="/privacy" className="hover:text-blue-600 dark:hover:text-blue-400">
            隐私协议
          </Link>
        </>
      ) : (
        <p>{text ?? '© 2025-2026 Phigros Query. All Rights Reserved.'}</p>
      )}
    </footer>
  );
}
