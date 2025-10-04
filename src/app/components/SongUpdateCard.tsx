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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-xl">
      <div className="flex flex-col md:flex-row">
        {/* Side Summary Panel */}
        <aside className="relative bg-gradient-to-b from-blue-500 to-purple-600 text-white px-6 py-4 md:py-6 md:w-64 shrink-0 flex items-center md:items-start justify-between md:justify-start gap-3 md:flex-col md:gap-4">
          <div className="flex items-center gap-3">
            <Music className="text-white" size={24} />
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold">Phigros {update.version}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2 text-white/90 text-sm md:mt-auto w-full">
            <Calendar size={16} />
            <span>{new Date(update.updateDate).toLocaleDateString('zh-CN')}</span>
            {isLatest && (
              <span className="ml-auto px-2 py-0.5 bg-white/25 backdrop-blur-sm text-white text-xs font-semibold rounded-full">
                最新
              </span>
            )}
          </div>
        </aside>

        {/* Content */}
        <section className="flex-1 px-6 py-4">
          <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed song-update-md prose-headings:my-2 prose-p:my-1 prose-ul:my-2 prose-li:my-0">
            <ReactMarkdown
              components={{
                // 隐藏 Markdown 一级标题，避免与卡片头重复
                h1: () => null,
                h2: ({ children }) => (
                  <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mt-2 mb-3 text-left">
                    {children}
                  </h2>
                ),
                // 歌曲名称
                h3: ({ children }) => (
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="my-1 text-gray-700 dark:text-gray-300">
                    {children}
                  </p>
                ),
                // 信息条目
                ul: ({ children }) => (
                  <ul className="list-none p-0 m-0 flex flex-wrap gap-x-6 gap-y-2">
                    {children}
                  </ul>
                ),
                li: ({ children }) => (
                  <li className="text-gray-700 dark:text-gray-300 flex items-center gap-2 text-sm">
                    {children}
                  </li>
                ),
                strong: ({ children }) => (
                  <strong className="inline-block px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-xs font-medium">
                    {children}
                  </strong>
                ),
                hr: () => (
                  <hr className="my-6 border-t-2 border-dashed border-gray-300 dark:border-gray-600" />
                )
              }}
            >
              {update.content}
            </ReactMarkdown>
          </div>
        </section>
      </div>
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
    <div className="space-y-6">
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
