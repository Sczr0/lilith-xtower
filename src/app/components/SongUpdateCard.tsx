"use client";

import ReactMarkdown from 'react-markdown';
import { Calendar, Music, Wrench } from 'lucide-react';
import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import { SongUpdate } from '../lib/types/content';

// 从 Markdown 内容中提取简单摘要：统计“新增曲目”和“调整/定数”等条目数（尽量保守，失败则为 0）
function countItemsInSection(md: string, keywords: string[]): number {
  try {
    const normalized = md.replace(/\r\n?/g, '\n');
    const sectionRe = new RegExp(`^#{1,6}\\s.*(${keywords.join('|')}).*$`, 'm');
    const m = normalized.match(sectionRe);
    if (!m || m.index === undefined) return 0;
    const startIdx = m.index + m[0].length;
    const after = normalized.slice(startIdx);
    const nextHeadingIdx = after.search(/^#{1,6}\s/m);
    const block = nextHeadingIdx === -1 ? after : after.slice(0, nextHeadingIdx);
    const listMatches = block.match(/^\s*[-*+]\s+/gm);
    return listMatches ? listMatches.length : 0;
  } catch {
    return 0;
  }
}

interface SongUpdateCardProps {
  update: SongUpdate;
  isLatest?: boolean;
}

export function SongUpdateCard({ update, isLatest = false }: SongUpdateCardProps) {
  const newSongCount = countItemsInSection(update.content, ['新增曲目', '新增', '新曲']);
  const changeCount = countItemsInSection(update.content, ['定数', '调整', '变更', '修正']);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-shadow hover:shadow-md">
      {/* 头部：中性/绿色点缀，禁止蓝紫渐变与紫色 */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <Music size={18} className="text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-semibold tracking-tight">Phigros {update.version}</h3>
        </div>
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
          <Calendar size={16} />
          <span>{new Date(update.updateDate).toLocaleDateString('zh-CN')}</span>
          {isLatest && (
            <span className="ml-2 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-400">
              最新
            </span>
          )}
        </div>
      </header>

      {/* 摘要条：快速呈现关键信息 */}
      {(newSongCount > 0 || changeCount > 0) && (
        <div className="px-5 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {newSongCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-400">
                <Music size={14} /> 新增 {newSongCount}
              </span>
            )}
            {changeCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-400">
                <Wrench size={14} /> 调整 {changeCount}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 内容区域 */}
      <section className="px-5 py-4">
        <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed song-update-md prose-headings:my-2 prose-p:my-1 prose-ul:my-2 prose-li:my-0">
          <ReactMarkdown
            components={{
              // 隐藏 Markdown 一级标题，避免与卡片头重复
              h1: () => null,
              // 小节标题采用低饱和绿色，突出层级且保持极简
              h2: (props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>) => (
                <h2 {...props} className={`text-base font-medium text-emerald-700 dark:text-emerald-400 mt-2 mb-3 text-left ${props.className || ''}`}>
                  {props.children}
                </h2>
              ),
              // 歌曲名称：去除顶部横线，让其自然衔接于"新增曲目"小节
              h3: (props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>) => (
                <h3 {...props} className={`text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mt-4 ${props.className || ''}`}>
                  {props.children}
                </h3>
              ),
              p: (props: DetailedHTMLProps<HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>) => (
                <p {...props} className={`my-1 text-gray-700 dark:text-gray-300 ${props.className || ''}`}>
                  {props.children}
                </p>
              ),
              // 信息条目：弹性换行，避免桌面端留白
              ul: (props: DetailedHTMLProps<HTMLAttributes<HTMLUListElement>, HTMLUListElement>) => (
                <ul {...props} className={`list-none p-0 m-0 flex flex-wrap items-start gap-x-6 gap-y-2 ${props.className || ''}`}>
                  {props.children}
                </ul>
              ),
              li: (props: DetailedHTMLProps<HTMLAttributes<HTMLLIElement>, HTMLLIElement>) => (
                <li {...props} className={`text-gray-700 dark:text-gray-300 flex items-center gap-2 text-sm ${props.className || ''}`}>
                  {props.children}
                </li>
              ),
              // 克制的强调
              strong: (props: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>) => (
                <strong {...props} className={`text-gray-800 dark:text-gray-200 font-medium ${props.className || ''}`}>
                  {props.children}
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

