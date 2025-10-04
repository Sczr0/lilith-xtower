'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { THEME_NAME_DESKTOP } from '../lib/constants/themeNames';

export function ThemeToggle() {
  const [mounted, setMounted] = React.useState(false);
  const { setTheme, theme, resolvedTheme } = useTheme();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveTheme = (theme === 'system' ? resolvedTheme : theme) as 'light' | 'dark' | undefined;

  if (!mounted) {
    return (
      <div className="inline-flex items-center">
        <button className="relative inline-flex h-9 w-9 items-center justify-center rounded-md align-middle lg:translate-y-[1px]">
          <Sun className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2" />
        </button>
        <span className="hidden lg:inline-block ml-2 text-sm text-gray-600 dark:text-gray-300 select-none" aria-hidden="true">
          {''}
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center">
      <button
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md align-middle lg:translate-y-[1px]"
        onClick={() => setTheme((effectiveTheme ?? 'light') === 'light' ? 'dark' : 'light')}
        aria-label="切换主题"
      >
        <Sun className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </button>
      <span className="hidden lg:inline-block mx-2 text-gray-400 select-none lg:translate-y-[1px]" aria-hidden="true">·</span>
      <span className="hidden lg:inline-block text-sm text-gray-600 dark:text-gray-300 select-none min-w-[5em] lg:translate-y-[1px]" aria-hidden="true">
        {effectiveTheme ? THEME_NAME_DESKTOP[effectiveTheme] : ''}
      </span>
    </div>
  );
}
