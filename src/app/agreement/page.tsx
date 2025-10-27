'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ClientHeader } from './ClientHeader';
import { TableOfContents } from './components/TableOfContents';

export default function AgreementPage() {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let aborted = false;

    setIsLoading(true);
    setError(null);

    fetch('/api/agreement')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.text();
      })
      .then(text => {
        if (!aborted) {
          setContent(text);
        }
      })
      .catch(err => {
        console.error('Failed to load agreement:', err);
        if (!aborted) {
          setError('用户协议暂时无法加载，请稍后重试。');
        }
      })
      .finally(() => {
        if (!aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      aborted = true;
    };
  }, []);

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
  }, [content]);

  const renderBody = () => {
    // 为ReactMarkdown创建自定义组件，为标题添加data-heading-id属性
    let headingCounter = 0;

    const components = {
      h1: ({children, ...props}) => {
        const id = `heading-${headingCounter++}`;
        return <h1 {...props} data-heading-id={id}>{children}</h1>;
      },
      h2: ({children, ...props}) => {
        const id = `heading-${headingCounter++}`;
        return <h2 {...props} data-heading-id={id}>{children}</h2>;
      },
      h3: ({children, ...props}) => {
        const id = `heading-${headingCounter++}`;
        return <h3 {...props} data-heading-id={id}>{children}</h3>;
      },
      h4: ({children, ...props}) => {
        const id = `heading-${headingCounter++}`;
        return <h4 {...props} data-heading-id={id}>{children}</h4>;
      },
      h5: ({children, ...props}) => {
        const id = `heading-${headingCounter++}`;
        return <h5 {...props} data-heading-id={id}>{children}</h5>;
      },
      h6: ({children, ...props}) => {
        const id = `heading-${headingCounter++}`;
        return <h6 {...props} data-heading-id={id}>{children}</h6>;
      }
    };

    return (
      <main className="px-4 py-10 sm:py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 lg:hidden">
            <TableOfContents content={content} activeSection={activeSection} variant="dropdown" />
          </div>

          <div className="lg:grid lg:grid-cols-4 lg:gap-8">
            <div className="space-y-6 lg:col-span-3 lg:col-start-1 lg:row-start-1">
              <section className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-6 py-6 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">用户协议</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">请在使用服务前仔细阅读以下条款。</p>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">最近更新：2025 年 9 月 29 日</span>
                </div>
              </section>

              <div
                ref={contentRef}
                className="agreement-markdown rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-6 py-8 shadow-sm"
              >
                <article className="prose prose-sm sm:prose dark:prose-invert max-w-none">
                  <ReactMarkdown components={components}>{content}</ReactMarkdown>
                </article>
              </div>
            </div>

            <aside className="hidden lg:block lg:col-span-1 lg:col-start-4 lg:row-start-1">
              <TableOfContents content={content} activeSection={activeSection} />
            </aside>
          </div>
        </div>
      </main>
    );
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-neutral-950 dark:text-gray-50">
      <ClientHeader />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-28 text-sm text-gray-500 dark:text-gray-400">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
          <span>正在加载用户协议...</span>
        </div>
      ) : error ? (
        <div className="px-4">
          <div className="mx-auto mt-16 max-w-xl rounded-lg border border-red-200 bg-red-50 px-6 py-6 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        </div>
      ) : (
        renderBody()
      )}
    </div>
  );
}
