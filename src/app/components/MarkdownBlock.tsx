"use client";

// 简化后的 MarkdownBlock：仅负责渲染已预编译的 HTML 片段
// 不再在运行时拉取或解析 Markdown

type Props = {
  html?: string;
  className?: string;
};

export default function MarkdownBlock({ html = "", className = "" }: Props) {
  if (!html) {
    return <div className={`text-sm text-gray-400 dark:text-gray-500 ${className}`}>暂无内容</div>;
  }
  return (
    <article className={`prose prose-sm sm:prose dark:prose-invert max-w-none ${className}`}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}

