'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

import { buttonStyles } from './ui/styles';

// Radix Dialog 依赖隔离在懒加载 chunk：首次打开才下载，
// 避免 @radix-ui/react-dialog 进入全站每个带页脚页面的首屏包。
const FeedbackDialogForm = dynamic(
  () => import('./FeedbackDialogForm').then((m) => m.FeedbackDialogForm),
  { ssr: false, loading: () => null },
);

interface FeedbackDialogProps {
  /** button=主要按钮；outline=描边按钮（错误页）；link=页脚链接样式 */
  variant?: 'button' | 'outline' | 'link';
  label?: string;
  /** 错误页传入：出错上下文会写入诊断信息轨迹 */
  initialError?: { message?: string; stack?: string; digest?: string };
}

/**
 * 反馈弹窗入口（轻量外壳）。
 *
 * 触发按钮直接渲染；依赖 Radix 的弹窗体在首次打开时才懒加载，
 * 因此本组件不再把 @radix-ui/react-dialog 带进全站首屏包。
 */
export function FeedbackDialog({
  variant = 'button',
  label = '遇到问题？',
  initialError,
}: FeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  const triggerClass =
    variant === 'link'
      ? 'hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer'
      : buttonStyles({ variant: variant === 'button' ? 'primary' : 'outline' });

  return (
    <>
      <button
        type="button"
        className={triggerClass}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setHasOpened(true);
          setOpen(true);
        }}
      >
        {label}
      </button>
      {/* 首次打开后保持挂载，让 Radix 能正常处理关闭动画（未打开时不渲染任何 DOM） */}
      {hasOpened && (
        <FeedbackDialogForm open={open} onOpenChange={setOpen} initialError={initialError} />
      )}
    </>
  );
}
