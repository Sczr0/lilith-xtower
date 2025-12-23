export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export type UiSize = 'sm' | 'md' | 'lg';
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: UiSize;
  fullWidth?: boolean;
  className?: string;
}

/**
 * 统一按钮样式（可用于 <button> / <a> / <Link>）
 * - rounded-xl：与站内 Select/Input 风格对齐
 * - focus:ring：统一可访问性与键盘焦点表现
 */
export function buttonStyles({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
}: ButtonStyleOptions = {}) {
  const sizeCls = size === 'sm' ? 'px-4 py-2 text-sm' : size === 'lg' ? 'px-5 py-3 text-base' : 'px-4 py-2.5 text-sm';
  const widthCls = fullWidth ? 'w-full' : '';

  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-neutral-950 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantCls =
    variant === 'primary'
      ? 'bg-blue-600 hover:bg-blue-700 text-white'
      : variant === 'secondary'
        ? 'bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-gray-100'
        : variant === 'danger'
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 border border-blue-600/70 dark:border-blue-400/70 hover:bg-blue-50 dark:hover:bg-blue-950/30';

  return cx(base, sizeCls, widthCls, variantCls, className);
}

interface CardStyleOptions {
  tone?: 'default' | 'glass';
  dashed?: boolean;
  padding?: UiSize;
  className?: string;
}

/**
 * 统一卡片容器样式
 * - default：白底卡片（plain 页/内容页）
 * - glass：玻璃拟态（gradient 页）
 */
export function cardStyles({ tone = 'default', dashed, padding = 'md', className }: CardStyleOptions = {}) {
  const paddingCls =
    padding === 'sm' ? 'p-4' : padding === 'lg' ? 'p-8' : 'p-6 sm:p-8';

  const base = cx('rounded-xl border', paddingCls);
  const border = dashed ? 'border-dashed' : '';
  const toneCls =
    tone === 'glass'
      ? 'bg-white/70 dark:bg-neutral-900/60 backdrop-blur-md border-gray-200/50 dark:border-neutral-800/60 shadow-lg'
      : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 shadow-sm';

  return cx(base, border, toneCls, className);
}

interface InputStyleOptions {
  className?: string;
}

/**
 * 统一输入框/文本域样式
 */
export function inputStyles({ className }: InputStyleOptions = {}) {
  const base =
    'w-full px-4 py-3 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 outline-none transition focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500';
  return cx(base, className);
}
