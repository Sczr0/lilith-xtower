'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ImageAPI, BestNTheme, type ImageFormat } from '../lib/api/image';
import { useGenerationBusy, useGenerationManager, useGenerationResult } from '../contexts/GenerationContext';
import { getOwnerKey } from '../lib/utils/cache';
import { StyledSelect } from './ui/Select';
import { LoadingPlaceholder, LoadingSpinner } from './LoadingIndicator';
import { SVGRenderer, type RenderProgress } from '../utils/svgRenderer';

const DEFAULT_N = 27;

// 支持通过 showDescription 隐藏组件内的描述，避免与外层重复
type BnImageGeneratorProps = {
  showTitle?: boolean;
  showDescription?: boolean;
  // 默认 png；demo 页面可传 svg 用于测试后端 SVG 输出与前端渲染
  format?: ImageFormat;
  // 仅当 format=svg 时生效：展示 SVG 源码用于排查渲染问题（默认关闭）
  showSvgSource?: boolean;
  // 仅当 format=svg 时生效：导出 PNG 时在控制台输出极其详细的渲染/抓取日志（默认关闭）
  debugExport?: boolean;
};

export function BnImageGenerator({
  showTitle = true,
  showDescription = true,
  format = 'png',
  showSvgSource = false,
  debugExport = false,
}: BnImageGeneratorProps) {
  const { credential } = useAuth();
  const [nInput, setNInput] = useState(`${DEFAULT_N}`);
  const [generatedN, setGeneratedN] = useState(DEFAULT_N);
  const [theme, setTheme] = useState<BestNTheme>('dark');
  const BESTN_TTL_MS = 5 * 60 * 1000; // 5分钟TTL，仅在成功展示后开始计时
  const BESTN_META_KEY = 'cache_bestn_meta_v1'; // { [ownerKey]: { [paramKey]: ts } }
  // 全局生成占用：同一类别（best-n）未返回前，占用按钮并提示“生成中”
  const { startTask, clearResult } = useGenerationManager();
  const isLoading = useGenerationBusy('best-n');
  // 跨页面读取最近一次生成结果（Blob）并转为 URL 展示
  const resultBlob = useGenerationResult<Blob>('best-n');
  const imageUrl = useMemo(() => (resultBlob ? URL.createObjectURL(resultBlob) : null), [resultBlob]);
  const [svgSource, setSvgSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextUpdateAt, setNextUpdateAt] = useState<number | null>(null);
  const [exportProgress, setExportProgress] = useState<RenderProgress | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  useEffect(() => {
    let cancelled = false;
    if (!resultBlob || format !== 'svg') {
      setSvgSource(null);
      return;
    }

    resultBlob
      .text()
      .then((text) => {
        if (!cancelled) setSvgSource(text);
      })
      .catch(() => {
        if (!cancelled) setSvgSource(null);
      });

    return () => {
      cancelled = true;
    };
  }, [resultBlob, format]);

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

    setError(null);

    // 组合参数键，区分不同 N/主题/格式
    const ownerKey = getOwnerKey(credential);
    const paramKey = `n:${parsed}|theme:${theme}|fmt:${format}`;
    try {
      if (ownerKey) {
        const metaRaw = localStorage.getItem(BESTN_META_KEY);
        const meta = (metaRaw ? JSON.parse(metaRaw) : {}) as Record<string, Record<string, number>>;
        const ts = meta?.[ownerKey]?.[paramKey];
        if (typeof ts === 'number') {
          const remain = ts + BESTN_TTL_MS - Date.now();
          if (remain > 0) {
            setNextUpdateAt(ts + BESTN_TTL_MS);
            setError(`冷却中，${new Date(ts + BESTN_TTL_MS).toLocaleTimeString()} 后可再次生成`);
            return;
          }
        }
      }
    } catch {}

    try {
      // 使用全局任务管理，避免页面切换中断并阻止同类重复请求；结果由上下文保存
      await startTask('best-n', async () => {
        return ImageAPI.generateBestNImage(parsed, credential, theme, format);
      });
      setGeneratedN(parsed);

      // 成功展示结果后再开始冷却计时
      try {
        if (ownerKey) {
          const metaRaw = localStorage.getItem(BESTN_META_KEY);
          const meta = (metaRaw ? JSON.parse(metaRaw) : {}) as Record<string, Record<string, number>>;
          const now = Date.now();
          meta[ownerKey] = { ...(meta[ownerKey] || {}), [paramKey]: now };
          localStorage.setItem(BESTN_META_KEY, JSON.stringify(meta));
          setNextUpdateAt(now + BESTN_TTL_MS);
        }
      } catch {}
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败';
      setError(message);
    }
  };

  const handleNChange = (value: string) => {
    setNInput(value);
  };

  const handleThemeChange = (value: string) => {
    setTheme(value === 'white' ? 'white' : 'dark');
  };

  const titleText = format === 'svg' ? 'Best N SVG 生成' : 'Best N 图片生成';
  const descriptionText =
    format === 'svg'
      ? '选择生成的歌曲数量和主题，点击生成即可获取 SVG（用于测试前端渲染）。'
      : '选择生成的歌曲数量和主题，点击生成即可获取图片。';
  const downloadName = `best-${generatedN}.${format}`;
  const downloadLabel = format === 'svg' ? '下载 SVG' : '下载图片';
  const placeholderText = format === 'svg' ? '正在生成 SVG...' : '正在生成图片...';
  const emptyText = format === 'svg' ? '生成后的 SVG 将显示在这里。' : '生成后的图片将显示在这里。';
  const generateButtonText = format === 'svg' ? '生成 SVG' : '生成图片';

  const safeInlineSvg = useMemo(() => {
    if (format !== 'svg') return null;
    if (!svgSource) return null;

    const injectStyle = (rawSvg: string, css: string) => {
      // 优先追加到已有 <style>，避免破坏原 SVG 结构；若不存在则插入新的 <style>
      if (/<style[\s>]/i.test(rawSvg) && /<\/style>/i.test(rawSvg)) {
        return rawSvg.replace(/<\/style>/i, `${css}\n</style>`);
      }
      if (/<defs[\s>]/i.test(rawSvg) && /<\/defs>/i.test(rawSvg)) {
        return rawSvg.replace(/<\/defs>/i, `<style>\n${css}\n</style>\n</defs>`);
      }
      return rawSvg.replace(/<svg\b([^>]*)>/i, `<svg$1><style>\n${css}\n</style>`);
    };

    // 安全兜底：仅用于 demo 内联预览，避免后端 SVG 被注入脚本/外部对象导致 XSS
    const unsafePatterns: RegExp[] = [
      /<script\b/i,
      /<foreignObject\b/i,
      /\bon\w+\s*=/i,
      /\bhref\s*=\s*["']\s*javascript:/i,
      /\bxlink:href\s*=\s*["']\s*javascript:/i,
    ];

    if (unsafePatterns.some((re) => re.test(svgSource))) {
      return null;
    }

    // 前端渲染与 Rust 渲染差异：浏览器可能对缺失字重的字体做“伪粗体”合成，导致粗体看起来发黑。
    // 这里禁用 font-synthesis，并把 700 的字重压到 600，尽量接近后端渲染观感（仅影响 demo 的内联预览）。
    const cssFix = [
      '/* Frontend demo fix: reduce synthetic bold/heavy rendering */',
      '* { font-synthesis: none; }',
      '.text-score, .text-difficulty-badge, .text-fc-ap-badge, .text-rank-tag { font-weight: 600 !important; }',
      'svg { text-rendering: geometricPrecision; }',
    ].join('\n');

    return injectStyle(svgSource, cssFix);
  }, [format, svgSource]);

  const handleExportPng = async () => {
    if (format !== 'svg') return;
    if (!svgSource) {
      setExportError('未找到 SVG 内容，请先生成一次。');
      return;
    }

    // 优先使用注入过 CSS 修正后的版本，保证与预览一致
    const svgText = safeInlineSvg ?? svgSource;

    setExportError(null);
    setExportProgress({ stage: 'loading-fonts', progress: 0 });

    try {
      const renderWithMode = (embedImages: 'data' | 'object') =>
        SVGRenderer.renderToImage(
          svgText,
          {
            format: 'png',
            scale: 2,
            quality: 0.95,
            embedImages,
            embedImageConcurrency: 6,
            embedImageMaxCount: 500,
            baseUrl: typeof window !== 'undefined' ? window.location.href : undefined,
            fontPackId: 'source-han-sans-saira-hybrid-5446',
            embedFonts: 'data',
            embedFontMaxFiles: 400,
            debug: debugExport,
            debugTag: 'BestNExport',
            waitBeforeDrawMs: 0,
          },
          (p) => setExportProgress(p),
        );

      let blob: Blob;
      try {
        // 优先稳定模式：把曲绘内联为 data: URL（大 N 也更不容易随机缺图）
        blob = await renderWithMode('data');
      } catch (e) {
        // 兜底：如果内联导致内存/体积问题，则退回 blob: URL 模式
        if (debugExport) {
          // eslint-disable-next-line no-console
          console.warn('[BestNExport] export fallback to embedImages=object:', e);
        }
        blob = await renderWithMode('object');
      }

      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = `best-${generatedN}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '导出失败';
      // 常见原因：SVG 内嵌图片跨域无 CORS，导致 canvas 被污染（tainted）或加载失败
      setExportError(`${message}（若含外链封面，请确认图片服务器允许 CORS 且未设置 CORP=same-origin）`);
    } finally {
      setExportProgress(null);
    }
  };

  return (
    <section className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-6 shadow-lg w-full max-w-4xl mx-auto">
      <div className="mb-6">
        {showTitle && (
          <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
            {titleText}
          </h2>
        )}
        {showDescription && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {descriptionText}
          </p>
        )}
        {nextUpdateAt && (
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {`下次可生成时间：${new Date(nextUpdateAt).toLocaleTimeString()}`}
          </p>
        )}
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
            className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            主题
          </label>
          <StyledSelect
            options={[
              { label: '深色主题', value: 'dark' },
              { label: '白色主题', value: 'white' },
            ]}
            value={theme as BestNTheme}
            onValueChange={(v) => handleThemeChange(v)}
            placeholder="选择主题"
          />
        </div>
        <div className="flex items-end">
          <button
            disabled={isLoading}
            onClick={handleGenerate}
            className="w-full inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-4 py-2 transition-colors"
          >
            {isLoading ? (
              // 生成请求等待动画（按钮内小尺寸旋转圈）
              <LoadingSpinner size="sm" text="生成中..." />
            ) : (
              generateButtonText
            )}
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
            {format === 'svg' ? (
              !svgSource ? (
                <div className="p-6 text-sm text-gray-600 dark:text-gray-300">SVG 解析中...</div>
              ) : safeInlineSvg ? (
                // 关键：SVG 内联到 DOM 后，<image href> 子资源才会正常发起请求（可配合同源代理验证封面加载）
                <div className="w-full [&>svg]:w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: safeInlineSvg }} />
              ) : (
                <div className="p-6 text-sm text-gray-600 dark:text-gray-300">
                  SVG 包含不安全内容，已阻止内联渲染；可使用下方下载查看原文件。
                </div>
              ) 
            ) : (
              <img
                src={imageUrl}
                alt={`Best ${generatedN} 成绩图片`}
                className="w-full h-auto"
              />
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={imageUrl}
              download={downloadName}
              className="inline-flex items-center justify-center rounded-lg border border-blue-500 px-4 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
            >
              {downloadLabel}
            </a>
            {format === 'svg' && (
              <button
                onClick={handleExportPng}
                disabled={!!exportProgress}
                className="inline-flex items-center justify-center rounded-lg border border-green-600 px-4 py-2 text-green-700 hover:bg-green-50 disabled:opacity-60 disabled:cursor-not-allowed dark:text-green-300 dark:hover:bg-green-900/20"
              >
                {exportProgress ? `导出中：${exportProgress.stage}` : '导出 PNG（本地渲染）'}
              </button>
            )}
            <button
              onClick={() => {
                clearResult('best-n');
              }}
              className="inline-flex items-center justify-center rounded-lg border border-gray-400 px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              清除结果
            </button>
          </div>

          {exportError && (
            <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {exportError}
            </div>
          )}

          {exportProgress && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-950/30 px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
              {`导出进度：${exportProgress.stage}（${exportProgress.progress}%）`}
            </div>
          )}

          {format === 'svg' && showSvgSource && (
            <details className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-3">
              <summary className="cursor-pointer select-none text-sm font-medium text-gray-800 dark:text-gray-200">
                查看 SVG 源码（调试用）
              </summary>
              <div className="mt-3">
                {svgSource ? (
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-3 text-xs text-gray-700 dark:text-gray-200">
                    {svgSource}
                  </pre>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">SVG 源码解析中...</p>
                )}
              </div>
            </details>
          )}
        </div>
      ) : isLoading ? (
        // 图片生成请求等候阶段的加载动画占位
        <LoadingPlaceholder text={placeholderText} />
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          {emptyText}
        </div>
      )}
    </section>
  );
}
