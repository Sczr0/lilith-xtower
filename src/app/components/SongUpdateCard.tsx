"use client";

import { useEffect, useMemo, useState } from 'react';
import { Markdown } from './Markdown';
import { Calendar, Music, Wrench } from 'lucide-react';
import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import { SongUpdate } from '../lib/types/content';
import { countNewSongs, countUpdateNoteChanges } from '../lib/utils/songUpdates';

function SongUpdateListSkeleton() {
  const items = Array.from({ length: 3 });
  return (
    <div className="space-y-5">
      {items.map((_, idx) => (
        <div
          key={idx}
          className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden animate-pulse"
        >
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="h-5 w-40 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
          <div className="px-5 py-4 space-y-2">
            <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface SongUpdateCardProps {
  update: SongUpdate;
  isLatest?: boolean;
}

export function SongUpdateCard({ update, isLatest = false }: SongUpdateCardProps) {
  const newSongCount = countNewSongs(update.content);
  const changeCount = countUpdateNoteChanges(update.content);

  return (
    <div
      id={`song-update-${update.updateId}`}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-shadow hover:shadow-md scroll-mt-6"
    >
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
          <Markdown
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
          </Markdown>
        </div>
      </section>
    </div>
  );
}

interface SongUpdateListProps {
  updates: SongUpdate[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function SongUpdateList({ updates, isLoading = false, error = null, onRetry }: SongUpdateListProps) {
  const [query, setQuery] = useState('');
  const [onlyLatest, setOnlyLatest] = useState(false);
  const [jumpToUpdateId, setJumpToUpdateId] = useState('');
  const latestUpdateId = updates[0]?.updateId;

  const filteredUpdates = useMemo(() => {
    const base = onlyLatest ? updates.slice(0, 1) : updates;
    const q = query.trim().toLowerCase();
    if (!q) return base;

    return base.filter((u) => {
      const haystack = `${u.version}\n${u.updateDate}\n${u.content}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [updates, onlyLatest, query]);

  useEffect(() => {
    if (!jumpToUpdateId) return;

    const targetId = `song-update-${jumpToUpdateId}`;
    requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setJumpToUpdateId('');
    });
  }, [jumpToUpdateId]);

  if (isLoading && updates.length === 0) {
    return <SongUpdateListSkeleton />;
  }

  if (error && updates.length === 0) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-6 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>{error}</div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:bg-transparent dark:text-red-200 dark:hover:bg-red-500/10"
            >
              重试
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!isLoading && updates.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <Music size={48} className="mx-auto mb-4 opacity-50" />
        <p className="text-lg">暂无新曲速递</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部工具条：搜索 / 过滤 / 跳转 / 刷新 */}
      <div className="space-y-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>{error}</div>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center justify-center rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:bg-transparent dark:text-red-200 dark:hover:bg-red-500/10"
                >
                  重试
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1">
            <label htmlFor="song-updates-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              搜索
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="song-updates-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索歌曲名 / 艺术家 / 版本…"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="shrink-0 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  清除
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={onlyLatest}
                onChange={(e) => setOnlyLatest(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              仅看最新
            </label>

            <select
              value={jumpToUpdateId}
              onChange={(e) => {
                const id = e.target.value;
                if (!id) {
                  setJumpToUpdateId('');
                  return;
                }

                // 版本跳转属于“强定位”，应先解除过滤，避免目标卡片不存在于 DOM
                if (query) setQuery('');
                if (onlyLatest) setOnlyLatest(false);
                setJumpToUpdateId(id);
              }}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              <option value="">版本跳转…</option>
              {updates.map((u) => (
                <option key={u.updateId} value={u.updateId}>
                  v{u.version} · {new Date(u.updateDate).toLocaleDateString('zh-CN')}
                </option>
              ))}
            </select>

            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={isLoading}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                title={isLoading ? '正在刷新…' : '刷新'}
              >
                {isLoading ? '刷新中…' : '刷新'}
              </button>
            )}
          </div>
        </div>
      </div>

      {filteredUpdates.length === 0 ? (
        <div className="text-center py-10 text-gray-500 dark:text-gray-400">
          <p className="text-lg">未找到匹配的更新</p>
          <p className="text-sm mt-2">可尝试更短的关键词（如歌曲名片段、版本号）。</p>
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-4 inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              清除搜索
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {filteredUpdates.map((update) => (
            <SongUpdateCard
              key={update.updateId}
              update={update}
              isLatest={!!latestUpdateId && update.updateId === latestUpdateId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
