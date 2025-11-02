'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps, ComponentType } from 'react';

// 轻量 Markdown 包装组件：按需动态加载 react-markdown，避免其及依赖链进入通用 chunk
// 注意：不默认引入 remark/rehype 插件，保持最小体积；如需扩展请在具体场景按需传入 props

// 动态导入 ReactMarkdown，禁用 SSR，确保仅在客户端加载
const ReactMarkdown = dynamic(() => import('react-markdown'), {
  ssr: false,
  loading: () => null,
}) as unknown as ComponentType<ComponentProps<any>>;

export type MarkdownProps = ComponentProps<typeof ReactMarkdown> & {
  // 明确 children 类型为字符串，便于调用方约束
  children: string;
};

export function Markdown(props: MarkdownProps) {
  return <ReactMarkdown {...props} />;
}

export default Markdown;
