'use client';

import type { MouseEventHandler, ReactNode } from 'react';
import Link from 'next/link';

import { cx } from '../ui/styles';

import type { NavItem } from './nav';
import { isExternalHref } from './nav';
import { buildGoHref } from '../../utils/outbound';

export const TOP_BAR_NAV_LINK_CLASSNAME =
  'text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors';

interface TopBarLinkProps {
  item: NavItem;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  children?: ReactNode;
}

/**
 * 顶栏链接渲染（统一 next/link 与外链 <a> 逻辑）。
 */
export function TopBarLink({ item, className, onClick, children }: TopBarLinkProps) {
  const content = children ?? item.label;
  const isExternal = !!item.external || isExternalHref(item.href);
  const goHref = buildGoHref(item.href);

  if (isExternal) {
    return (
      <a
        href={goHref ?? item.href}
        target={goHref ? '_blank' : undefined}
        rel={goHref ? 'noopener noreferrer' : undefined}
        referrerPolicy={goHref ? 'no-referrer' : undefined}
        onClick={onClick}
        className={cx(TOP_BAR_NAV_LINK_CLASSNAME, className)}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={item.href} onClick={onClick} className={cx(TOP_BAR_NAV_LINK_CLASSNAME, className)}>
      {content}
    </Link>
  );
}
