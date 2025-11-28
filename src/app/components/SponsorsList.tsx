"use client";

import { useEffect, useState, useRef } from 'react';
import { preloadImages, shouldPreload } from '../lib/utils/preload';

type SponsorUser = {
  user_id: string;
  name: string;
  avatar: string;
};

type SponsorItem = {
  user: SponsorUser;
  all_sum_amount?: string;
  last_pay_time?: number;
  create_time?: number;
  current_plan?: { name?: string } | null;
};

type ApiResponse = {
  ec: number;
  em?: string;
  data?: { total_count?: number; total_page?: number; list?: SponsorItem[] };
};

export default function SponsorsList({ initialPerPage = 12 }: { initialPerPage?: number }) {
  const [items, setItems] = useState<SponsorItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPage, setTotalPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preloadedRef = useRef<Set<string>>(new Set());

  const load = async (nextPage: number, perPage = initialPerPage) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/internal/sponsors?page=${nextPage}&per_page=${perPage}`, { cache: 'no-store' });
      const data: ApiResponse = await res.json();
      if (data.ec !== 200 || !data.data) throw new Error(data.em || '加载失败');
      const newItems = data.data!.list || [];
      setItems((prev) => (nextPage === 1 ? newItems : [...prev, ...newItems]));
      setTotalPage(data.data.total_page || 1);
      setPage(nextPage);
      
      // 预加载头像图片（首批立即加载，后续批次延迟加载）
      if (shouldPreload() && newItems.length > 0) {
        const avatarUrls = newItems
          .map((it) => it.user.avatar)
          .filter((url) => url && !preloadedRef.current.has(url));
        
        if (avatarUrls.length > 0) {
          // 首批（前6个）立即预加载，其余延迟
          const immediate = avatarUrls.slice(0, 6);
          const deferred = avatarUrls.slice(6);
          
          // 标记为已预加载
          avatarUrls.forEach((url) => preloadedRef.current.add(url));
          
          // 立即预加载首批
          preloadImages(immediate, 3);
          
          // 延迟预加载其余
          if (deferred.length > 0) {
            setTimeout(() => preloadImages(deferred, 2), 1000);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1, initialPerPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPerPage]);

  const canLoadMore = page < totalPage;

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      {/* 列表 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {items.map((it) => (
          <div key={it.user.user_id} className="border border-gray-200 dark:border-neutral-800 rounded-xl p-4 flex items-center gap-3">
            <img
              src={it.user.avatar}
              alt={it.user.name}
              className="h-12 w-12 rounded-full object-cover bg-gray-100 dark:bg-neutral-800"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <div className="font-medium truncate">{it.user.name || '匿名'}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {(it.current_plan?.name || '').trim() || '赞助者'}
                {it.all_sum_amount ? ` · ¥${it.all_sum_amount}` : ''}
              </div>
            </div>
          </div>
        ))}
        {loading && items.length === 0 && (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-dashed border-gray-200 dark:border-neutral-800 rounded-xl p-4 h-[64px] animate-pulse" />
          ))
        )}
      </div>

      {/* 加载更多 */}
      <div className="pt-2">
        {canLoadMore ? (
          <button
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800"
            onClick={() => load(page + 1)}
            disabled={loading}
          >
            {loading ? '加载中…' : '加载更多'}
          </button>
        ) : (
          items.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">已全部加载</span>
          )
        )}
      </div>
    </div>
  );
}
