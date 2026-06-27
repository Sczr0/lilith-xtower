'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { PageShell } from '../components/PageShell';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';
import { verifySvgSignature, extractSvgSignature } from '../utils/svgRenderer';
import type { SvgSignature } from '../utils/svgRenderer';

type VerifyState = 'idle' | 'loading' | 'svg-valid' | 'svg-invalid' | 'png-found' | 'png-none' | 'error';

interface SvgVerifyResult {
  valid: boolean
  signedAt?: string
  userId?: string
  error?: string
}

interface SvgLocalMeta {
  hmac: string
  requestId: string | null
  contentHash: string | null
  nonce: string | null
}

interface PngWatermarkMeta {
  userId: string
  signedAt: string
  contentHash: string
}

/** 从 SVG 中提取可见验证码文本 */
function extractVerifyBadge(svg: string): string | null {
  const m = /<g[^>]*class="lilith-verify-badge"[^>]*>[\s\S]*?<text[^>]*>([^<]+)<\/text>[\s\S]*?<\/g>/i.exec(svg)
  return m?.[1]?.trim() ?? null
}

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function hexBytes(bytes: Uint8Array): string {
  return Array.from(bytes.slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export default function VerifyPage() {
  const [state, setState] = useState<VerifyState>('idle')
  const [svgResult, setSvgResult] = useState<SvgVerifyResult | null>(null)
  const [svgMeta, setSvgMeta] = useState<SvgLocalMeta | null>(null)
  const [verifyBadge, setVerifyBadge] = useState<string | null>(null)
  const [pngMeta, setPngMeta] = useState<PngWatermarkMeta | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── 判断文件类型并分发 ──
  const handleFile = useCallback(async (file: File) => {
    setErrorMsg(null)
    setSvgResult(null)
    setSvgMeta(null)
    setVerifyBadge(null)
    setPngMeta(null)

    const ext = file.name.split('.').pop()?.toLowerCase()
    const isSvg = ext === 'svg' || file.type === 'image/svg+xml'
    const isPng = ext === 'png' || file.type === 'image/png'

    if (!isSvg && !isPng) {
      setState('error')
      setErrorMsg('请上传 SVG 或 PNG 格式的文件')
      return
    }

    setState('loading')

    try {
      const text = await file.text()

      if (isSvg) {
        await verifySvg(text)
      } else if (isPng) {
        await verifyPng(file)
      }
    } catch (err) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : '文件读取失败')
    }
  }, [])

  // ── SVG：通过后端 HMAC 验证 ──
  const verifySvg = async (svgText: string) => {
    setSvgMeta(null)
    setVerifyBadge(null)

    // 提取本地签名元数据
    const sig = extractSvgSignature(svgText)
    if (!sig) {
      setState('svg-invalid')
      setSvgResult({ valid: false, error: 'SVG 不包含签名信息（lilith-sig）' })
      return
    }

    setSvgMeta({
      hmac: sig.hmac,
      requestId: sig.requestId,
      contentHash: sig.contentHash,
      nonce: sig.nonce,
    })
    setVerifyBadge(extractVerifyBadge(svgText))

    // 如果 v3 有 contentHash，先做客户端本地 SHA-256 校验
    if (sig.contentHash) {
      try {
        const body = svgText
          .replace(/<!--\s*lilith-sig:[\s\S]*?-->/g, '')
          .replace(/<g[^>]*class="lilith-verify-badge"[^>]*>[\s\S]*?<\/g>/g, '')
        const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
        const hashHex = Array.from(new Uint8Array(hashBuf))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
        if (hashHex !== sig.contentHash) {
          setState('svg-invalid')
          setSvgResult({ valid: false, error: `内容哈希不匹配（本地=${hashHex.slice(0, 16)}… ≠ 签名=${sig.contentHash.slice(0, 16)}…），SVG 已被篡改` })
          return
        }
      } catch {
        // crypto.subtle 不可用时跳过本地校验，仍走后端
      }
    }

    // 后端 HMAC 验证
    try {
      const result = await verifySvgSignature(svgText, '/api')
      setSvgResult(result)
      setState(result.valid ? 'svg-valid' : 'svg-invalid')
    } catch (err) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : '验证请求失败')
    }
  }

  // ── PNG：客户端提取隐写水印 ──
  const verifyPng = async (file: File) => {
    // 将 PNG 加载到 canvas 获取 ImageData
    const img = await loadImageFromFile(file)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建 canvas 上下文')
    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // 尝试用空种子快速扫描（先用 magic 字节暴力探测，然后逐步验证）
    // 说明：需要知道 sigHash 才能确定像素位置。而 sigHash 来自原始签名。
    // 对于 PNG 水印提取，我们需要用户同时提供原始的 sigHash（从 SVG 签名中获取）。
    // 
    // 简化方案：用户上传 PNG 时，我们只能做"水印存在性检测"——扫描全图 LSB 寻找魔数。
    // 这比完整提取更慢但不需要 sigHash。
    const foundMagic = scanWatermarkMagic(imageData)

    if (foundMagic) {
      // 提取到了魔数，尝试用找到的 sigHash 做完整提取
      try {
        const { extractWatermark } = await import('../utils/stego/index')
        const sigHash = foundMagic.sigHash
        const result = extractWatermark(imageData, sigHash, {
          spreadFactor: 3,
          channelOffset: 2,
          marginPixels: 8,
        })

        if (result.found && result.payload) {
          const p = result.payload
          setPngMeta({
            userId: hexBytes(p.userId),
            signedAt: formatTimestamp(p.timestamp),
            contentHash: hexBytes(p.contentHash),
          })
          setState('png-found')
          return
        }
      } catch {
        // 降级：至少有魔数
      }

      // 魔数找到但完整提取失败——显示部分信息
      setPngMeta({
        userId: hexBytes(foundMagic.sigHash),
        signedAt: '无法解析',
        contentHash: '无法解析',
      })
      setState('png-found')
      return
    }

    setState('png-none')
  }

  // ── 拖放 ──
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <PageShell
      variant="gradient"
      header={<SiteHeader />}
      mainClassName="flex min-h-[calc(100vh-12rem)] items-start justify-center px-4 py-10"
      containerClassName="mx-auto w-full max-w-lg"
      afterMain={
        <div className="px-4 pb-10">
          <div className="mx-auto max-w-7xl"><SiteFooter /></div>
        </div>
      }
    >
      <section className="w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            图片验证
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            上传 SVG 或 PNG 图片，验证其来源真伪。
          </p>
        </div>

        {/* 上传区 */}
        <div
          className={`relative rounded-2xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer ${
            dragOver
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40 hover:border-blue-300'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/svg+xml,image/png"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
          {state === 'loading' ? (
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
              <p className="text-sm text-gray-500">正在验证…</p>
            </div>
          ) : (
            <div className="space-y-2">
              <svg className="mx-auto w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                拖放或点击上传 <strong>SVG</strong> 或 <strong>PNG</strong> 图片
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                SVG → 后端 HMAC 签名验证（最可靠）<br />
                PNG → 客户端隐写水印检测
              </p>
            </div>
          )}
        </div>

        {/* ── SVG 验证结果 ── */}
        {state === 'svg-valid' && svgResult && (
          <div className="rounded-2xl border border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-800 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium text-green-700 dark:text-green-300">
                ✓ HMAC 签名验证通过 — 此 SVG 由本服务签发
              </span>
            </div>
            <dl className="text-xs text-green-600 dark:text-green-400 space-y-1">
              {svgResult.signedAt && (
                <div className="flex gap-2"><dt className="font-medium">签发时间：</dt><dd>{svgResult.signedAt}</dd></div>
              )}
              {svgResult.userId && (
                <div className="flex gap-2"><dt className="font-medium">用户标识：</dt><dd className="font-mono">{svgResult.userId}</dd></div>
              )}
              {verifyBadge && (
                <div className="flex gap-2"><dt className="font-medium">校验码：</dt><dd className="font-mono">{verifyBadge}</dd></div>
              )}
              {svgMeta?.requestId && (
                <div className="flex gap-2"><dt className="font-medium">请求 ID：</dt><dd className="font-mono text-[10px]">{svgMeta.requestId}</dd></div>
              )}
              {svgMeta?.contentHash && (
                <div className="flex gap-2"><dt className="font-medium">内容哈希：</dt><dd className="font-mono text-[10px]">{svgMeta.contentHash.slice(0, 24)}…</dd></div>
              )}
            </dl>
          </div>
        )}

        {state === 'svg-invalid' && svgResult && (
          <div className="rounded-2xl border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium text-red-700 dark:text-red-300">
                ✗ 签名验证失败
              </span>
            </div>
            <p className="text-xs text-red-600 dark:text-red-400">
              {svgResult.error || '此 SVG 可能被篡改或并非本服务生成'}
            </p>
          </div>
        )}

        {/* ── PNG 水印检测结果 ── */}
        {state === 'png-found' && pngMeta && (
          <div className="rounded-2xl border border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium text-blue-700 dark:text-blue-300">
        检测到隐写溯源标识
              </span>
            </div>
            <dl className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
              <div className="flex gap-2"><dt className="font-medium">签发时间：</dt><dd>{pngMeta.signedAt}</dd></div>
              {pngMeta.userId !== '0000000000000000' && (
                <div className="flex gap-2"><dt className="font-medium">用户标识：</dt><dd className="font-mono">{pngMeta.userId}</dd></div>
              )}
              <div className="flex gap-2"><dt className="font-medium">内容哈希：</dt><dd className="font-mono">{pngMeta.contentHash}…</dd></div>
            </dl>
            <p className="text-xs text-blue-500 dark:text-blue-400 mt-2">
              注意：隐写水印可证明图片来源，但不如 SVG HMAC 签名可靠。
              如需最强验证，请使用原始 SVG 文件。
            </p>
          </div>
        )}

        {state === 'png-none' && (
          <div className="rounded-2xl border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium text-yellow-700 dark:text-yellow-300">
        未检测到隐写溯源标识
              </span>
            </div>
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              此 PNG 可能不是本服务生成，或经过格式转换、缩放等操作后水印已丢失。
            </p>
          </div>
        )}

        {state === 'error' && (
          <div className="rounded-2xl border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-6 space-y-3">
            <p className="text-sm text-red-700 dark:text-red-300">{errorMsg || '验证出错'}</p>
          </div>
        )}

        <div className="text-center">
          <Link href="/" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
            返回首页
          </Link>
        </div>
      </section>
    </PageShell>
  )
}

// ── 辅助函数 ──

/** 将 File 加载为 HTMLImageElement */
function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

/**
 * 快速扫描 ImageData 中是否包含水印魔数。
 * 因为不知道 sigHash，这里用暴力扫描：每隔 N 个像素检查 LSB 序列是否匹配魔数。
 * 同时提取候选 sigHash。
 */
function scanWatermarkMagic(imageData: ImageData): { sigHash: Uint8Array } | null {
  const pixels = imageData.data
  const w = imageData.width
  const h = imageData.height
  const step = 8 // 步长（像素），减小扫描范围

  // 魔数的 bit 模式（前 32 bits = 4 字节，MSB first）
  const MAGIC_BITS = [
    1,1,1,1,1,1,0,0, // 0xfc
    1,0,1,0,0,1,1,1, // 0xa7
    0,0,0,0,0,0,1,1, // 0x03
    1,1,1,0,0,0,0,1, // 0xe1
  ]

  // 跳过边缘
  const margin = 8
  const maxX = w - margin
  const maxY = h - margin

  // 在图像中心区域采样
  for (let startY = margin; startY < maxY; startY += step * 4) {
    for (let startX = margin; startX < maxX; startX += step * 4) {
      // 从这个位置读取 32 个 LSB，看是否匹配魔数
      const bits: number[] = []
      let idx = startY * w + startX
      for (let i = 0; i < 32; i += 1) {
        if (idx * 4 + 2 >= pixels.length) break
        bits.push(pixels[idx * 4 + 2]! & 1) // B 通道 LSB
        idx += step // 每 step 像素取一个 LSB
      }

      if (bits.length < 32) continue

      // 比较魔数
      let match = true
      for (let i = 0; i < 32; i += 1) {
        if (bits[i] !== MAGIC_BITS[i]!) {
          match = false
          break
        }
      }

      if (match) {
        // 找到魔数！现在读取后续的 sigHash（接下来 32 字节 / 256 bits）
        const sigHash = new Uint8Array(32)
        let bitIdx = 0
        for (let byteIdx = 0; byteIdx < 32; byteIdx += 1) {
          let byte = 0
          for (let j = 0; j < 8; j += 1) {
            const pxIdx = (startY * w + startX) + (32 + bitIdx) * step
            if (pxIdx * 4 + 2 < pixels.length) {
              byte = (byte << 1) | (pixels[pxIdx * 4 + 2]! & 1)
            }
            bitIdx += 1
          }
          sigHash[byteIdx] = byte
        }

        return { sigHash }
      }
    }
  }
  return null
}
