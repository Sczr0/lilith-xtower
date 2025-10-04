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
      <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
        <Sun className="h-4 w-4 flex-shrink-0" />
        <span className="hidden lg:inline-block text-sm text-gray-600 dark:text-gray-300 select-none">
          {''}
        </span>
      </button>
    );
  }

  return (
    <button
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      onClick={() => setTheme((effectiveTheme ?? 'light') === 'light' ? 'dark' : 'light')}
      aria-label="切换主题"
    >
      <div className="relative h-4 w-4 flex-shrink-0">
        <Sun className="absolute inset-0 h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute inset-0 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </div>
      <span className="hidden lg:inline-block text-sm text-gray-600 dark:text-gray-300 select-none">
        {effectiveTheme ? THEME_NAME_DESKTOP[effectiveTheme] : ''}
      </span>
    </button>
  );
}
