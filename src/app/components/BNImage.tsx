'use client';

import { useState } from 'react';
import { SVGRenderer, RenderOptions, RenderProgress } from '../utils/svgRenderer';
import { StyledSelect } from './ui/Select';

interface BNImageProps {
  svgContent: string;
  n: number;
  onClear?: () => void;
}

export function BNImage({ svgContent, n, onClear }: BNImageProps) {
  const [downloadFormat, setDownloadFormat] = useState<'png' | 'jpg' | 'webp'>('png');
  const [downloadScale, setDownloadScale] = useState<number>(2);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    setProgress(null);

    try {
      const options: RenderOptions = {
        format: downloadFormat,
        quality: 0.95,
        scale: downloadScale,
      };

      const filename = `best-${n}.${downloadFormat}`;

      await SVGRenderer.downloadImage(
        svgContent,
        filename,
        options,
        (prog) => setProgress(prog)
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : '下载失败';
      setError(message);
      console.error('Download error:', err);
    } finally {
      setIsDownloading(false);
      setProgress(null);
    }
  };

  const getProgressText = () => {
    if (!progress) return '';
    switch (progress.stage) {
      case 'loading-fonts':
        return '加载字体中...';
      case 'rendering':
        return '渲染中...';
      case 'encoding':
        return '编码中...';
      case 'complete':
        return '完成！';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div
          className="w-full h-auto"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {isDownloading && progress && (
        <div className="rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-blue-700 dark:text-blue-300">
              {getProgressText()}
            </span>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {progress.progress}%
            </span>
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            下载格式
          </label>
          <StyledSelect
            options={[
              { label: 'PNG (推荐)', value: 'png' },
              { label: 'JPG', value: 'jpg' },
              { label: 'WebP', value: 'webp' },
            ]}
            value={downloadFormat}
            onValueChange={(v) => setDownloadFormat(v as 'png' | 'jpg' | 'webp')}
            placeholder="选择格式"
            disabled={isDownloading}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            分辨率
          </label>
          <StyledSelect
            options={[
              { label: '1x (标准)', value: '1' },
              { label: '2x (高清)', value: '2' },
              { label: '3x (超高清)', value: '3' },
              { label: '4x (极致)', value: '4' },
            ]}
            value={String(downloadScale)}
            onValueChange={(v) => setDownloadScale(Number(v))}
            placeholder="选择分辨率"
            disabled={isDownloading}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-4 py-2 transition-colors"
        >
          {isDownloading ? '下载中...' : '下载图片'}
        </button>

        {onClear && (
          <button
            onClick={onClear}
            disabled={isDownloading}
            className="inline-flex items-center justify-center rounded-lg border border-gray-400 px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            清除结果
          </button>
        )}
      </div>

      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
        <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
          提示
        </h3>
        <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <li>• SVG 格式显示清晰且体积小，适合在线查看</li>
          <li>• 下载时会在本地渲染成高分辨率图片，无需服务器参与</li>
          <li>• 推荐使用 PNG 格式和 2x 分辨率，质量和文件大小较为均衡</li>
          <li>• 分辨率越高，渲染时间越长，请耐心等待</li>
        </ul>
      </div>
    </div>
  );
}
