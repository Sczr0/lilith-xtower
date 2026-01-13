'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TableOfContents } from './TableOfContents';
import { SignatureBar } from './SignatureBar';
import type { PrecompiledSignatureInfo } from '@/app/lib/precompiled-types';

interface TocItem {
  id: string;
  title: string;
  level: number;
}

interface AgreementContentProps {
  htmlContent: string;
  tocItems: TocItem[];
  title?: string;
  subtitle?: string;
  signatureInfo?: PrecompiledSignatureInfo;
}

const getHeadingId = (element: HTMLElement) =>
  element.getAttribute('data-heading-id') || element.id || '';

/**
 * 客户端组件：处理滚动监听与目录高亮等交互逻辑
 * - 缓存 headings，避免每次 scroll 都 querySelectorAll
 * - 使用 requestAnimationFrame 合并滚动更新，降低掉帧风险
 * - activeSection 未变化时不 setState，减少无意义渲染
 */
export function AgreementContent({
  htmlContent,
  tocItems,
  title = '用户协议',
  subtitle = '请在使用服务前仔细阅读以下条款。',
  signatureInfo,
}: AgreementContentProps) {
  const [activeSection, setActiveSection] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const topOffsetRef = useRef(0);

  const headingsRef = useRef<HTMLElement[]>([]);
  const rafRef = useRef<number | null>(null);
  const activeIdRef = useRef<string>('');

  // 说明：目录高亮需要抵消“粘性顶栏”的占位高度，避免写死魔法数。
  const measureTopOffset = useCallback(() => {
    if (typeof window === 'undefined') return 0;
    const topbar = document.querySelector<HTMLElement>('[data-topbar]');
    if (!topbar) return 0;
    return Math.max(0, Math.round(topbar.getBoundingClientRect().height));
  }, []);

  const refreshTopOffset = useCallback(() => {
    topOffsetRef.current = measureTopOffset();
  }, [measureTopOffset]);

  const updateActiveSection = useCallback(() => {
    const headings = headingsRef.current;
    if (!headings || headings.length === 0) {
      if (activeIdRef.current !== '') {
        activeIdRef.current = '';
        setActiveSection('');
      }
      return;
    }

    const scrollPosition = window.scrollY + topOffsetRef.current;

    for (let i = headings.length - 1; i >= 0; i -= 1) {
      const element = headings[i];
      if (element.offsetTop <= scrollPosition) {
        const next = getHeadingId(element);
        if (next !== activeIdRef.current) {
          activeIdRef.current = next;
          setActiveSection(next);
        }
        return;
      }
    }

    const first = headings[0] ? getHeadingId(headings[0]) : '';
    if (first !== activeIdRef.current) {
      activeIdRef.current = first;
      setActiveSection(first);
    }
  }, []);

  const scheduleUpdate = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      updateActiveSection();
    });
  }, [updateActiveSection]);

  useEffect(() => {
    // htmlContent 变更时只做一次 DOM 查询
    if (!contentRef.current) return;
    headingsRef.current = Array.from(
      contentRef.current.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'),
    );
    refreshTopOffset();
    scheduleUpdate();
  }, [htmlContent, refreshTopOffset, scheduleUpdate]);

  useEffect(() => {
    const onScroll = () => scheduleUpdate();
    const onResize = () => {
      refreshTopOffset();
      scheduleUpdate();
    };

    refreshTopOffset();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    scheduleUpdate();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [refreshTopOffset, scheduleUpdate]);

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
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">{title}</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
                </div>
              </div>
            </section>

            <div
              ref={contentRef}
              className="agreement-markdown rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-6 py-8 shadow-sm"
            >
              <article className="prose prose-sm sm:prose dark:prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
              </article>

              {signatureInfo ? <SignatureBar signatureInfo={signatureInfo} /> : null}
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
