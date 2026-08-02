'use client';

import { useCallback, useRef, useState } from 'react';
import {
  SVGRenderer,
  rewriteSvgImageUrlsToSameOriginProxy,
  injectSvgStyle,
  type RenderProgress,
} from '../utils/svgRenderer';

export type SvgRenderState = 'idle' | 'loading-svg' | 'rendering' | 'done' | 'error';
export type WatermarkStatus = 'none' | 'embedded' | 'skipped';

/**
 * 字体修复 CSS：与旧版 SVG 预览保持一致，抑制 canvas 合成粗体。
 */
const FONT_FIX_CSS = [
  '* { font-synthesis: none; }',
  '.text-score, .text-difficulty-badge, .text-fc-ap-badge, .text-rank-tag { font-weight: 600 !important; }',
  'svg { text-rendering: geometricPrecision; }',
].join('\n');

/**
 * 将渲染状态映射为用户可读的阶段文案（供加载占位显示）。
 */
export function describeRenderStage(
  state: SvgRenderState,
  progress: RenderProgress | null,
): string | null {
  if (state === 'loading-svg') return '正在从服务器获取成绩数据…';
  if (state === 'rendering') {
    if (progress) {
      switch (progress.stage) {
        case 'loading-fonts':
          return '加载字体中…';
        case 'fetching-images':
          return `下载封面图 (${progress.progress}%)…`;
        case 'rendering':
          return '渲染图片…';
        case 'encoding':
          return '编码输出…';
        case 'complete':
          return '完成！';
      }
    }
    return '渲染中…';
  }
  return null;
}

interface UseSvgToWatermarkedPngOptions {
  debug?: boolean;
  debugTag?: string;
}

/**
 * SVG → 带隐写水印 PNG 的公共渲染管线。
 *
 * 背景：Best N / 玩家成绩渲染 / 单曲成绩查询 均从后端获取 SVG 模板，
 * 客户端渲染为 PNG（字体内联 + 曲绘抓取 + LSB 隐写水印 + PNG tEXt 签名）。
 * 本 hook 将该管线（原 BnImageGenerator 内部实现）抽为公共能力，供三个组件复用。
 *
 * 用法：
 *   const { renderSvgToPng, startLoading, renderState, ... } = useSvgToWatermarkedPng();
 *   startLoading();                          // 拉取 SVG 前的状态
 *   const svgText = await fetchSvg(...);     // 业务方自己拉 SVG
 *   const pngBlob = await renderSvgToPng(svgText, fallback?);  // 渲染（失败可回退后端 PNG）
 */
export function useSvgToWatermarkedPng(options?: UseSvgToWatermarkedPngOptions) {
  const debug = options?.debug ?? false;
  const debugTag = options?.debugTag ?? 'SVGToPng';

  const [renderState, setRenderState] = useState<SvgRenderState>('idle');
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const [watermarkStatus, setWatermarkStatus] = useState<WatermarkStatus>('none');
  const svgTextRef = useRef<string | null>(null);

  /** 进入「拉取 SVG」阶段（渲染管线开始前调用）。 */
  const startLoading = useCallback(() => {
    setRenderState('loading-svg');
    setRenderProgress(null);
    setWatermarkStatus('none');
    svgTextRef.current = null;
  }, []);

  /**
   * 将后端返回的 SVG 渲染为带水印的 PNG Blob。
   * - 首选 embedImages='data' 直连抓取曲绘；失败后改写为同源代理 + 'object' 模式重试。
   * - 前端渲染失败时，若提供 fallback，则回退到后端 PNG（旧行为）保证功能可用。
   */
  const renderSvgToPng = useCallback(
    async (svgText: string, fallback?: () => Promise<Blob>): Promise<Blob> => {
      const fixedSvgText = injectSvgStyle(svgText, FONT_FIX_CSS);
      svgTextRef.current = fixedSvgText;

      setRenderState('rendering');
      setRenderProgress(null);
      setWatermarkStatus('none');

      const baseUrl = typeof window !== 'undefined' ? window.location.href : undefined;

      const renderWithMode = async (
        sourceSvg: string,
        embedMode: 'data' | 'object',
        allowProxy: boolean,
      ): Promise<Blob> => {
        return SVGRenderer.renderToImage(
          sourceSvg,
          {
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
            debug,
            debugTag,
            waitBeforeDrawMs: 0,
            watermark: {
              svgText: sourceSvg,
              enabled: true,
            },
          },
          (p) => setRenderProgress(p),
        );
      };

      try {
        let pngBlob: Blob;
        try {
          pngBlob = await renderWithMode(fixedSvgText, 'data', false);
        } catch (directError) {
          if (debug) {
            console.warn(`[${debugTag}] direct render failed, retry with proxy:`, directError);
          }
          const proxiedSvg = rewriteSvgImageUrlsToSameOriginProxy(fixedSvgText, {
            baseUrl,
            allowedHosts: ['somnia.xtower.site'],
          });
          svgTextRef.current = proxiedSvg;
          pngBlob = await renderWithMode(proxiedSvg, 'object', true);
        }

        setWatermarkStatus('embedded');
        setRenderState('done');
        setRenderProgress(null);
        return pngBlob;
      } catch (err) {
        // 前端渲染失败时回退到后端 PNG（旧行为），保证功能可用
        if (fallback) {
          try {
            const pngBlob = await fallback();
            // 后端 PNG 自带水印，前端不再重复嵌入
            setWatermarkStatus('none');
            setRenderState('done');
            setRenderProgress(null);
            return pngBlob;
          } catch {
            // 回退失败则报告原始渲染错误
          }
        }
        setRenderState('error');
        setRenderProgress(null);
        throw err;
      }
    },
    [debug, debugTag],
  );

  const clear = useCallback(() => {
    setRenderState('idle');
    setRenderProgress(null);
    setWatermarkStatus('none');
    svgTextRef.current = null;
  }, []);

  return {
    renderSvgToPng,
    startLoading,
    clear,
    renderState,
    renderProgress,
    watermarkStatus,
    svgTextRef,
  };
}
