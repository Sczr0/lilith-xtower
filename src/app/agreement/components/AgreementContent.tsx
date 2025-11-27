'use client';

import { useEffect, useRef, useState } from 'react';
import { TableOfContents } from './TableOfContents';

interface TocItem {
  id: string;
  title: string;
  level: number;
}

interface AgreementContentProps {
  htmlContent: string;
  tocItems: TocItem[];
}

/**
 * 客户端组件：处理滚动监听和目录高亮等交互逻辑
 */
export function AgreementContent({ htmlContent, tocItems }: AgreementContentProps) {
  const [activeSection, setActiveSection] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return;

      const headings = contentRef.current.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6');
      const scrollPosition = window.scrollY + 120;

      for (let i = headings.length - 1; i >= 0; i -= 1) {
        const element = headings[i];
        if (element.offsetTop <= scrollPosition) {
          setActiveSection(element.textContent || '');
          return;
        }
      }

      if (headings.length > 0) {
        setActiveSection(headings[0].textContent || '');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [htmlContent]);

  return (
    <main className="px-4 py-10 sm:py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 lg:hidden">
          <TableOfContents content={undefined} toc={tocItems} activeSection={activeSection} variant="dropdown" />
        </div>

        <div className="lg:grid lg:grid-cols-4 lg:gap-8">
          <div className="space-y-6 lg:col-span-3 lg:col-start-1 lg:row-start-1">
            <section className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-6 py-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">用户协议</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">请在使用服务前仔细阅读以下条款。</p>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">最近更新：2025-10-28</span>
              </div>
            </section>

            <div
              ref={contentRef}
              className="agreement-markdown rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-6 py-8 shadow-sm"
            >
              <article className="prose prose-sm sm:prose dark:prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
              </article>
            </div>
          </div>

          <aside className="hidden lg:block lg:col-span-1 lg:col-start-4 lg:row-start-1">
            <TableOfContents content={undefined} toc={tocItems} activeSection={activeSection} />
          </aside>
        </div>
      </div>
    </main>
  );
}