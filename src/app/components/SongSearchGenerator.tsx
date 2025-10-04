'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ImageAPI } from '../lib/api/image';

export function SongSearchGenerator() {
  const { credential } = useAuth();
  const [songQuery, setSongQuery] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  const handleSearch = async () => {
    if (!credential) {
      setError('未找到登录凭证，请重新登录。');
      return;
    }

    if (!songQuery.trim()) {
      setError('请输入歌曲名称或关键词。');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const blob = await ImageAPI.generateSongImage(songQuery, credential);
      const url = URL.createObjectURL(blob);
      setImageUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return url;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '查询失败';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <section className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-6 shadow-lg w-full max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
          单曲成绩查询
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          输入歌曲名称、ID 或别名来查询您的成绩记录。
        </p>
      </div>

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={songQuery}
          onChange={(e) => setSongQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="例如：Spasmodic、Cthugha 等"
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          disabled={isLoading}
          onClick={handleSearch}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-6 py-2 transition-colors"
        >
          {isLoading ? '查询中…' : '查询'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {imageUrl ? (
        <div className="space-y-4">
          <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <img
              src={imageUrl}
              alt={`${songQuery} 成绩图片`}
              className="w-full h-auto"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={imageUrl}
              download={`${songQuery}.png`}
              className="inline-flex items-center justify-center rounded-lg border border-blue-500 px-4 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
            >
              下载图片
            </a>
            <button
              onClick={() => setImageUrl((prev) => {
                if (prev) {
                  URL.revokeObjectURL(prev);
                }
                return null;
              })}
              className="inline-flex items-center justify-center rounded-lg border border-gray-400 px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              清除结果
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          输入歌曲关键词后点击查询，图片将显示在这里。
        </div>
      )}
    </section>
  );
}
