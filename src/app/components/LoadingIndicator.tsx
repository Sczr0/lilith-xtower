'use client';

import React from 'react';
import { RotatingTips } from './RotatingTips';

interface LoadingSpinnerProps {
  /** 可选的提示文本 */
  text?: string;
  /** 尺寸，默认 md */
  size?: 'sm' | 'md' | 'lg';
  /** 自定义额外类名 */
  className?: string;
}

/**
 * 通用加载指示器：旋转动画 + 可选文本
 * - 使用 Tailwind 的 animate-spin 实现旋转
 * - 通过边框实现简洁的圆环效果
 */
export function LoadingSpinner({ text, size = 'md', className = '' }: LoadingSpinnerProps) {
  const dim = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-12 h-12' : 'w-8 h-8';
  // Tailwind 边框宽度：统一使用常见的 2/4，避免非标准 class
  const ring = size === 'sm' ? 'border-2' : 'border-4';
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      <div
        className={`${dim} ${ring} rounded-full animate-spin border-gray-300 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400`}
        aria-label="loading"
        role="status"
      />
      {text && (
        <span className="text-sm text-gray-600 dark:text-gray-300 select-none">{text}</span>
      )}
    </div>
  );
}

interface LoadingPlaceholderProps {
  /** 文本提示，默认：正在加载... */
  text?: string;
}

/**
 * 用于占位区域的简洁加载占位内容
 */
export function LoadingPlaceholder({ text = '正在加载图片...' }: LoadingPlaceholderProps) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center bg-white/40 dark:bg-gray-900/30">
      <LoadingSpinner text={text} size="lg" className="mx-auto" />
      <RotatingTips className="mt-2" />
    </div>
  );
}
