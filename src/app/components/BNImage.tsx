'use client';

import { useEffect, useMemo, useState } from 'react';
import { SVGRenderer, RenderOptions, RenderProgress, extractSvgSignature, verifySvgSignature } from '../utils/svgRenderer';
import type { SvgSignature } from '../utils/svgRenderer';
import { StyledSelect } from './ui/Select';

interface BNImageProps {
  svgContent: string;
  n: number;
  onClear?: () => void;
}

/** 从 SVG 中提取可见验证码文本 */
function extractVerifyBadge(svg: string): string | null {
  const badgeMatch = /<g[^>]*class="lilith-verify-badge"[^>]*>([\s\S]*?)<\/g>/i.exec(svg)
  if (!badgeMatch) return null
  const textMatch = /<text[^>]*>([^<]+)<\/text>/i.exec(badgeMatch[0])
  return textMatch?.[1]?.trim() ?? null
}

export function BNImage({ svgContent, n, onClear }: BNImageProps) {
  const [downloadFormat, setDownloadFormat] = useState<'png' | 'jpg' | 'webp'>('png');
  const [downloadScale, setDownloadScale] = useState<number>(2);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── 签名验证（真正调后端）──
  const [verifyState, setVerifyState] = useState<'idle' | 'loading' | 'valid' | 'invalid' | 'error'>('idle');
  const [verifyDetail, setVerifyDetail] = useState<string | null>(null);
  const [verifySignedAt, setVerifySignedAt] = useState<string | null>(null);
  const [verifyUserId, setVerifyUserId] = useState<string | null>(null);

  // 提取签名元数据
  const signature: SvgSignature | null = useMemo(
    () => extractSvgSignature(svgContent),
    [svgContent],
  );
  const signedDate = useMemo(() => {
    if (!signature) return null;
    return new Date(signature.timestamp * 1000);
  }, [signature]);

  // 可见验证码
  const verifyBadge = useMemo(() => extractVerifyBadge(svgContent), [svgContent]);

  // 真正调用后端验证签名
  useEffect(() => {
    if (!svgContent || !signature) {
      setVerifyState('idle');
      return;
    }

    // 先做本地快速检查：如果 v3 有 contentHash，比对客户端计算值
    if (signature.contentHash) {
      // 去掉签名注释和 verify badge 后计算 SHA-256
      const body = svgContent
        .replace(/<!--\s*lilith-sig:[\s\S]*?-->/g, '')
        .replace(/<g[^>]*class="lilith-verify-badge"[^>]*>[\s\S]*?<\/g>/g, '')
      // 用 Web Crypto API 算 SHA-256
      crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
        .then(hashBuf => {
          const hashHex = Array.from(new Uint8Array(hashBuf))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
          if (hashHex !== signature.contentHash) {
            setVerifyState('invalid')
            setVerifyDetail('内容哈希不匹配：SVG 可能已被篡改')
          }
        })
        .catch(() => {})
    }

    // 然后调后端做完整 HMAC 验证
    setVerifyState('loading')
    verifySvgSignature(svgContent, '/api')
      .then(result => {
        setVerifyState(result.valid ? 'valid' : 'invalid')
        setVerifyDetail(result.error ?? null)
        setVerifySignedAt(result.signedAt ?? null)
        setVerifyUserId(result.userId ?? null)
      })
      .catch(err => {
        setVerifyState('error')
        setVerifyDetail(err instanceof Error ? err.message : '验证请求失败')
      })
  }, [svgContent, signature])

  // 说明：SVG 预览仅用于展示，禁止将 SVG 字符串注入 DOM（dangerouslySetInnerHTML）以避免 XSS 风险。
  const svgPreviewUrl = useMemo(() => {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
  }, [svgContent]);

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    setProgress(null);

    try {
      const options: RenderOptions = {
        format: downloadFormat,
        quality: 0.95,
        scale: downloadScale,
        // 下载 PNG 时嵌入隐写水印
        watermark: downloadFormat === 'png' ? { svgText: svgContent, enabled: true } : undefined,
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
      case 'loading-fonts': return '加载字体中...';
      case 'rendering': return '渲染中...';
      case 'encoding': return '编码中...';
      case 'complete': return '完成！';
      default: return '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={svgPreviewUrl}
          alt={`Best ${n} SVG 预览`}
          className="w-full h-auto"
          loading="lazy"
          decoding="async"
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
            <span className="text-sm text-blue-700 dark:text-blue-300">{getProgressText()}</span>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{progress.progress}%</span>
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress.progress}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">下载格式</label>
          <StyledSelect
            options={[
              { label: 'PNG (推荐，含溯源保护)', value: 'png' },
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">分辨率</label>
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

      {/* ── 签名验证状态（真实后端验证）── */}
      {verifyState === 'valid' && (
        <div className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              ✓ 签名验证通过
            </span>
          </div>
          <div className="mt-1 text-xs text-green-600 dark:text-green-400 space-y-0.5">
            {verifySignedAt && <p>签发时间：{verifySignedAt}</p>}
            {verifyUserId && <p>用户标识：{verifyUserId}</p>}
            {verifyBadge && <p className="font-mono text-[11px]">校验码：{verifyBadge}</p>}
            {signature?.contentHash && (
              <p className="font-mono text-[10px] opacity-60">Hash: {signature.contentHash.slice(0, 16)}…</p>
            )}
          </div>
        </div>
      )}

      {verifyState === 'invalid' && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-red-700 dark:text-red-300">
              ✗ 签名验证失败
            </span>
          </div>
          {verifyDetail && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{verifyDetail}</p>}
        </div>
      )}

      {verifyState === 'loading' && (
        <div className="rounded-lg border border-gray-300 bg-gray-50 dark:bg-gray-900/20 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">正在验证签名…</span>
          </div>
        </div>
      )}
    </div>
  );
}
