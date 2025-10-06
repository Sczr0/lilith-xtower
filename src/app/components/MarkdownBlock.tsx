"use client";

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

type Props = {
  // 静态 Markdown 路径（位于 public 下），例如 "/about/custom.md"
  src?: string;
  className?: string;
};

export default function MarkdownBlock({ src = "/about/custom.md", className = "" }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    setError(null);
    setContent(null);

    // 从 public 目录读取静态 Markdown
    fetch(src)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!aborted) setContent(text);
      })
      .catch((e) => {
        if (!aborted) setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      aborted = true;
    };
  }, [src]);

  if (error) {
    return (
      <div className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}>
        {/* 未找到或读取失败时的提示，指导放置位置 */}
        无法读取 Markdown（{error}）。请在 public/about/custom.md 放置你的内容文件。
      </div>
    );
  }

  if (content == null) {
    return (
      <div className={`text-sm text-gray-400 dark:text-gray-500 ${className}`}>加载中…</div>
    );
  }

  return (
    <article className={`prose prose-sm sm:prose dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </article>
  );
}
