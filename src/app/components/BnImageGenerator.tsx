'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ImageAPI, BestNTheme } from '../lib/api/image';

const DEFAULT_N = 19;

export function BnImageGenerator() {
  const { credential } = useAuth();
  const [nInput, setNInput] = useState(`${DEFAULT_N}`);
  const [generatedN, setGeneratedN] = useState(DEFAULT_N);
  const [theme, setTheme] = useState<BestNTheme>('dark');
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

  const handleGenerate = async () => {
    if (!credential) {
      setError('未找到登录凭证，请重新登录。');
      return;
    }

    if (!nInput.trim()) {
      setError('请输入有效的 N 值。');
      return;
    }

    const parsed = Number.parseInt(nInput, 10);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError('请输入有效的 N 值。');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 强制使用 PNG
      const blob = await ImageAPI.generateBestNImage(parsed, credential, theme, 'png');
      const url = URL.createObjectURL(blob);
      setImageUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return url;
      });
      setGeneratedN(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNChange = (value: string) => {
    setNInput(value);
  };

  const handleThemeChange = (value: string) => {
    setTheme(value === 'white' ? 'white' : 'dark');
  };

  return (
    <section className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-6 shadow-lg w-full max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
          Best N 图片生成
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          选择生成的歌曲数量和主题，点击生成即可获取图片。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            N 值
          </label>
          <input
            type="number"
            min={1}
            value={nInput}
            onChange={(event) => handleNChange(event.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            主题
          </label>
          <select
            value={theme}
            onChange={(event) => handleThemeChange(event.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="dark">深色主题</option>
            <option value="white">白色主题</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            disabled={isLoading}
            onClick={handleGenerate}
            className="w-full inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-4 py-2 transition-colors"
          >
            {isLoading ? '生成中…' : '生成图片'}
          </button>
        </div>
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
              alt={`Best ${generatedN} 成绩图片`}
              className="w-full h-auto"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={imageUrl}
              download={`best-${generatedN}.png`}
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
          生成后的图片将显示在这里。
        </div>
      )}
    </section>
  );
}
