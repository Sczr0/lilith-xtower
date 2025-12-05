'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps, ComponentType } from 'react';
import type ReactMarkdownComponent from 'react-markdown';

type ReactMarkdownProps = ComponentProps<typeof ReactMarkdownComponent>;

// 动态导入 ReactMarkdown，禁用 SSR，确保仅在客户端加载
const ReactMarkdown = dynamic<ComponentProps<typeof ReactMarkdownComponent>>(
  () => import('react-markdown'),
  {
    ssr: false,
    loading: () => null,
  },
) as ComponentType<ReactMarkdownProps>;

export type MarkdownProps = ReactMarkdownProps & {
  // 明确 children 类型为字符串，便于调用方约束
  children: string;
};

export function Markdown(props: MarkdownProps) {
  return <ReactMarkdown {...props} />;
}

export default Markdown;
