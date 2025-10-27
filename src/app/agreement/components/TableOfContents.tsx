'use client';

import { useEffect, useMemo, useState } from 'react';

interface TableOfContentsProps {
  content: string;
  activeSection: string;
  variant?: 'sidebar' | 'dropdown';
}

interface TocItem {
  id: string;
  title: string;
  level: number;
}

export function TableOfContents({ content, activeSection, variant = 'sidebar' }: TableOfContentsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const tocItems = useMemo<TocItem[]>(() => {
    if (!content) return [];

    const lines = content.split('\n');
    const items: TocItem[] = [];
    let headingCounter = 0; // 使用标题计数器而非行号

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      const match = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const title = match[2].replace(/\*\*/g, '').trim();
        const id = `heading-${headingCounter}`; // 使用标题计数器
        items.push({ id, title, level });
        headingCounter++;
      }
    });

    return items;
  }, [content]);

  useEffect(() => {
    // 内容发生变更后收起移动端折叠面板
    setIsOpen(false);
  }, [content]);

  
  const scrollToSection = (id: string) => {
    // 通过data-heading-id属性查找对应的标题元素
    const targetHeading = document.querySelector(`[data-heading-id="${id}"]`);

    if (targetHeading) {
      targetHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (variant === 'dropdown') {
        setIsOpen(false);
      }
    } else {
      console.error('Target heading not found for ID:', id);
      // 降级方案：使用原始的索引方法
      const targetIndex = parseInt(id.split('-')[1] ?? '', 10);
      const headings = document.querySelectorAll('.agreement-markdown h1, .agreement-markdown h2, .agreement-markdown h3, .agreement-markdown h4, .agreement-markdown h5, .agreement-markdown h6');
      if (!Number.isNaN(targetIndex) && headings[targetIndex]) {
        headings[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (variant === 'dropdown') {
          setIsOpen(false);
        }
      }
    }
  };

  if (tocItems.length === 0) return null;

  if (variant === 'dropdown') {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
        >
          <span>目录</span>
          <svg
            className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isOpen && (
          <nav className="border-t border-gray-200 dark:border-neutral-800 px-2 py-3 text-sm">
            {tocItems.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className={`block w-full rounded-md px-2 py-1 text-left transition-colors ${
                  activeSection === item.title
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-neutral-800 dark:hover:text-gray-100'
                }`}
                style={{ paddingLeft: `${(item.level - 1) * 12 + 12}px` }}
              >
                {item.title}
              </button>
            ))}
          </nav>
        )}
      </div>
    );
  }

  return (
    <nav className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span>目录</span>
      </div>
      <div className="space-y-1 text-sm">
        {tocItems.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => scrollToSection(item.id)}
            className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
              activeSection === item.title
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-neutral-800 dark:hover:text-gray-100'
            }`}
            style={{ paddingLeft: `${(item.level - 1) * 12 + 12}px` }}
          >
            {item.title}
          </button>
        ))}
      </div>
    </nav>
  );
}
