'use client';

import ReactMarkdown from 'react-markdown';
import { Calendar, Music } from 'lucide-react';
import { SongUpdate } from '../lib/types/content';

interface SongUpdateCardProps {
  update: SongUpdate;
  isLatest?: boolean;
}

export function SongUpdateCard({ update, isLatest = false }: SongUpdateCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-shadow hover:shadow-md">
      {/* 极简风格头部：去除渐变侧栏，改为简洁的顶栏布局（蓝/白/黑/灰配色） */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <Music size={18} className="text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold tracking-tight">Phigros {update.version}</h3>
        </div>
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
          <Calendar size={16} />
          <span>{new Date(update.updateDate).toLocaleDateString('zh-CN')}</span>
          {isLatest && (
            <span className="ml-2 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:border-blue-700/50 dark:bg-blue-900/20 dark:text-blue-400">
              最新
            </span>
          )}
        </div>
      </header>

      {/* 内容区域 */}
      <section className="px-5 py-4">
        <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed song-update-md prose-headings:my-2 prose-p:my-1 prose-ul:my-2 prose-li:my-0">
            <ReactMarkdown
              components={{
                // 隐藏 Markdown 一级标题，避免与卡片头重复
                h1: () => null,
                // 小节标题采用低饱和蓝色，突出层级且保持极简
                h2: ({ children }) => (
                  <h2 className="text-base font-medium text-blue-600 dark:text-blue-400 mt-2 mb-3 text-left">
                    {children}
                  </h2>
                ),
                // 歌曲名称：去除顶部横线，让其自然衔接于“新增曲目”小节
                h3: ({ children }) => (
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mt-4">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="my-1 text-gray-700 dark:text-gray-300">
                    {children}
                  </p>
                ),
                // 信息条目：改为弹性换行，避免两列网格在桌面端造成“曲绘”与其他信息的过大留白
                ul: ({ children }) => (
                  <ul className="list-none p-0 m-0 flex flex-wrap items-start gap-x-6 gap-y-2">
                    {children}
                  </ul>
                ),
                li: ({ children }) => (
                  <li className="text-gray-700 dark:text-gray-300 flex items-center gap-2 text-sm">
                    {children}
                  </li>
                ),
                // 将标签高亮改为更克制的文字强调，减少背景块以符合极简
                strong: ({ children }) => (
                  <strong className="text-gray-800 dark:text-gray-200 font-medium">
                    {children}
                  </strong>
                ),
                hr: () => (
                  <hr className="my-6 border-t border-gray-200 dark:border-gray-800" />
                )
              }}
            >
              {update.content}
            </ReactMarkdown>
        </div>
      </section>
    </div>
  );
}

interface SongUpdateListProps {
  updates: SongUpdate[];
}

export function SongUpdateList({ updates }: SongUpdateListProps) {
  if (updates.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <Music size={48} className="mx-auto mb-4 opacity-50" />
        <p className="text-lg">暂无新曲速递</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {updates.map((update, index) => (
        <SongUpdateCard 
          key={update.updateId} 
          update={update} 
          isLatest={index === 0}
        />
      ))}
    </div>
  );
}
