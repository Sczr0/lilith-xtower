'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ImageAPI, BestNTheme, type ImageFormat } from '../lib/api/image';
import { useGenerationBusy, useGenerationManager, useGenerationResult } from '../contexts/GenerationContext';
import { StyledSelect } from './ui/Select';
import { LoadingPlaceholder, LoadingSpinner } from './LoadingIndicator';
import { SVGRenderer, rewriteSvgImageUrlsToSameOriginProxy, type RenderProgress } from '../utils/svgRenderer';

const DEFAULT_N = 27;

type BnImageGeneratorProps = {
  showTitle?: boolean;
  showDescription?: boolean;
  /** 内部固定为 svg（从后端拉取），预览统一渲染为 PNG */
  format?: ImageFormat;
  /** 调试：展示渲染日志 */
  debugExport?: boolean;
};

/**
 * Best N 图片生成器（隐写水印版）
 * 
 * 与旧版的核心区别：
 * - 不再提供 SVG 预览或下载
 * - 后端返回 SVG → 客户端直接渲染为 PNG → 嵌入隐写水印 → 展示 PNG 预览
 * - 下载按钮只导出水印 PNG
 * - 隐写代码通过 build-time 混淆，增加逆向难度
 */
export function BnImageGenerator({
  showTitle = true,
  showDescription = true,
  debugExport = false,
}: BnImageGeneratorProps) {
  const { isAuthenticated } = useAuth();
  const [nInput, setNInput] = useState(`${DEFAULT_N}`);
  const [generatedN, setGeneratedN] = useState(DEFAULT_N);
  const [theme, setTheme] = useState<BestNTheme>('dark');

  const { startTask, clearResult } = useGenerationManager();
  const isLoading = useGenerationBusy('best-n');

  // ── 渲染状态 ──
  const [renderState, setRenderState] = useState<'idle' | 'loading-svg' | 'rendering' | 'done' | 'error'>('idle');
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watermarkStatus, setWatermarkStatus] = useState<'none' | 'embedded' | 'skipped'>('none');

  // 保存原始 SVG 文本用于水印签名提取
  const svgTextRef = useRef<string | null>(null);
  // 保存 PNG Blob 用于下载
  const pngBlobRef = useRef<Blob | null>(null);

  // 清理 blob URL
  useEffect(() => {
    return () => {
      if (pngUrl) URL.revokeObjectURL(pngUrl);
    };
  }, [pngUrl]);

  const handleGenerate = async () => {
    if (!isAuthenticated) {
      setError('请先登录后再生成图片。');
      return;
    }

    const parsed = Number.parseInt(nInput, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError('请输入有效的 N 值。');
      return;
    }

    setError(null);
    setRenderState('loading-svg');
    setPngUrl(null);
    setWatermarkStatus('none');
    pngBlobRef.current = null;
    svgTextRef.current = null;

    try {
      // ── 1. 从后端拉取 SVG（始终请求 SVG，即使最终要 PNG）──
      const svgBlob = await startTask('best-n', async () => {
        return ImageAPI.generateBestNImage(parsed, theme, 'svg');
      });

      const svgText = await svgBlob.text();
      svgTextRef.current = svgText;

      setGeneratedN(parsed);
      setRenderState('rendering');
      setWatermarkStatus('none');

      // ── 2. 渲染 SVG → 带水印的 PNG ──
      const baseUrl = typeof window !== 'undefined' ? window.location.href : undefined;

      const renderWithMode = async (
        embedMode: 'data' | 'object',
        allowProxy: boolean,
      ): Promise<Blob> => {
        return SVGRenderer.renderToImage(svgText, {
          format: 'png',
          scale: 2,
          quality: 0.95,
          embedImages: embedMode,
          embedImageConcurrency: 32,
          embedImageMaxCount: 500,
          baseUrl,
          fontPackId: 'source-han-sans-saira-hybrid-5446',
          embedFonts: 'data',
          embedFontMaxFiles: 400,
          allowProxyFallback: allowProxy,
          debug: debugExport,
          debugTag: 'BestNExport',
          waitBeforeDrawMs: 0,
          // ★ 关键：传入原始 SVG 用于水印嵌入
          watermark: {
            svgText,
            enabled: true,
          },
        }, (p) => setRenderProgress(p));
      };

      let pngBlob: Blob;
      try {
        pngBlob = await renderWithMode('data', false);
      } catch (directError) {
        if (debugExport) console.warn('[BestNExport] direct render failed, retry with proxy:', directError);
        const proxiedSvg = rewriteSvgImageUrlsToSameOriginProxy(svgText, {
          baseUrl,
          allowedHosts: ['somnia.xtower.site'],
        });
        // 更新水印用的 SVG 引用（代理改写后签名注释仍在）
        svgTextRef.current = proxiedSvg;
        pngBlob = await renderWithMode('object', true);
      }

      pngBlobRef.current = pngBlob;

      // ── 3. 生成预览 URL ──
      if (pngUrl) URL.revokeObjectURL(pngUrl);
      const url = URL.createObjectURL(pngBlob);
      setPngUrl(url);
      setWatermarkStatus('embedded');
      setRenderState('done');
      setRenderProgress(null);

    } catch (err) {
      const message = err instanceof Error ? err.message : '生成失败';
      setError(message);
      setRenderState('error');
      setRenderProgress(null);
    }
  };

  const handleDownload = () => {
    if (!pngBlobRef.current) return;
    const url = URL.createObjectURL(pngBlobRef.current);
    const a = document.createElement('a');
    a.href = url;
    a.download = `best-${generatedN}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleClear = () => {
    if (pngUrl) URL.revokeObjectURL(pngUrl);
    setPngUrl(null);
    pngBlobRef.current = null;
    svgTextRef.current = null;
    setRenderState('idle');
    setRenderProgress(null);
    setWatermarkStatus('none');
    clearResult('best-n');
  };

  // ── UI ──

  const renderStageText = () => {
    if (renderState === 'loading-svg') return '正在从服务器获取成绩数据…';
    if (renderState === 'rendering') {
      if (renderProgress) {
        switch (renderProgress.stage) {
          case 'loading-fonts': return '加载字体中…';
          case 'fetching-images': return `下载封面图 (${renderProgress.progress}%)…`;
          case 'rendering': return '渲染图片…';
          case 'encoding': return '编码输出…';
          case 'complete': return '完成！';
        }
      }
      return '渲染中…';
    }
    return null;
  };

  return (
    <section className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-6 shadow-lg w-full max-w-4xl mx-auto">
      <div className="mb-6">
        {showTitle && (
          <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
            Best N 图片生成
          </h2>
        )}
        {showDescription && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            选择生成的歌曲数量和主题，点击生成即可获取带保护标识的图片。
          </p>
        )}
      </div>

      {/* 参数区 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">N 值</label>
          <input
            type="number"
            min={1}
            value={nInput}
            onChange={(e) => setNInput(e.target.value)}
            className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">主题</label>
          <StyledSelect
            options={[
              { label: '深色主题', value: 'dark' },
              { label: '白色主题', value: 'white' },
            ]}
            value={theme}
            onValueChange={(v) => setTheme(v === 'white' ? 'white' : 'dark')}
            placeholder="选择主题"
          />
        </div>
        <div className="flex items-end">
          <button
            disabled={isLoading}
            onClick={handleGenerate}
            className="w-full inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-4 py-2 transition-colors"
          >
            {isLoading ? <LoadingSpinner size="sm" text="生成中..." /> : '生成图片'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* 预览区 */}
      {pngUrl ? (
        <div className="space-y-4">
          <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pngUrl}
              alt={`Best ${generatedN} 成绩图片`}
              className="w-full h-auto"
              loading="lazy"
              decoding="async"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleDownload}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 transition-colors"
            >
              下载 PNG
            </button>
            <button
              onClick={handleClear}
              className="inline-flex items-center justify-center rounded-lg border border-gray-400 px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              清除结果
            </button>
          </div>

          {/* 水印状态 */}
          {watermarkStatus === 'embedded' && (
            <div className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  图片已嵌入溯源保护标识
                </span>
              </div>
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                此 PNG 包含不可见的数字签名，用于验证图片来源于本服务。
              </p>
            </div>
          )}
        </div>
      ) : isLoading || renderState !== 'idle' ? (
        <LoadingPlaceholder text={renderStageText() ?? '正在生成图片...'} />
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          生成后的图片将显示在这里
        </div>
      )}

      {/* 提示信息 */}
      {renderState === 'done' && (
        <div className="mt-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">关于图片保护</h3>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <li>• 图片包含隐写溯源标识，可在需要时验证来源</li>
            <li>• 如需验证他人分享的 BestN 图片真伪，请使用图片验证工具</li>
          </ul>
        </div>
      )}
    </section>
  );
}
