'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps, ComponentType } from 'react';
import type ReactMarkdownComponent from 'react-markdown';
import type { Components } from 'react-markdown';

import { buildGoHref } from '../utils/outbound';

type ReactMarkdownProps = ComponentProps<typeof ReactMarkdownComponent>;

function MarkdownLoadingFallback() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-800 rounded" />
      <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-800 rounded" />
      <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-800 rounded" />
    </div>
  );
}

// 动态导入 ReactMarkdown，禁用 SSR，确保仅在客户端加载
const ReactMarkdown = dynamic<ComponentProps<typeof ReactMarkdownComponent>>(
  () => import('react-markdown'),
  {
    ssr: false,
    // 避免动态加载阶段出现“内容全空白”，提供轻量占位提升可感知性
    loading: () => <MarkdownLoadingFallback />,
  },
) as ComponentType<ReactMarkdownProps>;

export type MarkdownProps = ReactMarkdownProps & {
  // 明确 children 类型为字符串，便于调用方约束
  children: string;
};

export function Markdown(props: MarkdownProps) {
  const components: Components = {
    ...(props.components ?? {}),
    a: ({ node: _node, href, children, ...rest }) => {
      // 说明：react-markdown 会注入 node 属性；此处不透传到 DOM，且显式“使用”以避免 lint unused 警告。
      void _node;
      const rawHref = typeof href === 'string' ? href : '';
      const goHref = rawHref ? buildGoHref(rawHref) : null;
      if (goHref) {
        return (
          <a
            {...rest}
            href={goHref}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            {children}
          </a>
        );
      }

      return (
        <a {...rest} href={rawHref}>
          {children}
        </a>
      );
    },
  };

  return <ReactMarkdown {...props} components={components} />;
}

export default Markdown;
