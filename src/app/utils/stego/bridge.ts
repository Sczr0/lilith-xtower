/**
 * 从 SVG 的 lilith-sig 签名构造 WatermarkPayload
 * 
 * 这是连接签名系统和隐写引擎的桥梁。
 * 提取签名字段 → 构造载荷 → 传给嵌入器
 */

import type { WatermarkPayload } from './types'
import { extractSvgSignature, type SvgSignature } from '../svgRenderer'

/**
 * 从 SVG 的 lilith-sig 中提取签名信息并构造水印载荷。
 * 如果 SVG 不含签名，返回 null（水印不强求签名）。
 */
export function buildPayloadFromSignature(
  svgText: string,
  sigOverride?: SvgSignature | null,
): WatermarkPayload | null {
  const sig = sigOverride ?? extractSvgSignature(svgText)
  if (!sig) return null

  // HMAC hex → Uint8Array（取前 32 字节）
  const hmacHex = sig.hmac.replace(/[^0-9a-fA-F]/g, '')
  const sigHash = new Uint8Array(32)
  for (let i = 0; i < 32 && i * 2 < hmacHex.length; i += 1) {
    sigHash[i] = parseInt(hmacHex.slice(i * 2, i * 2 + 2), 16) || 0
  }

  // userId → 8 字节 ASCII
  const uidStr = (sig.userId || 'anon').slice(0, 8)
  const userId = new Uint8Array(8)
  for (let i = 0; i < uidStr.length; i += 1) {
    userId[i] = uidStr.charCodeAt(i) & 0xff
  }

  // 内容哈希：优先使用 v3 签名的 hash 字段（SHA-256，由后端计算，绝对准确）
  // 回退到客户端 FNV-1a（仅在旧版 v2 签名时使用）
  const contentHash = sig.contentHash
    ? hexToBytes(sig.contentHash, 8)
    : hashSvgContent(svgText)

  return {
    magic: 0, // 由 encodePayload 填入
    version: 1,
    sigHash,
    timestamp: sig.timestamp,
    userId,
    contentHash,
  }
}

/** hex 字符串 → Uint8Array（取前 N 字节） */
function hexToBytes(hex: string, maxBytes: number): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '')
  const out = new Uint8Array(maxBytes)
  for (let i = 0; i < maxBytes && i * 2 < clean.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0
  }
  return out
}

/** 对去掉签名注释的 SVG 内容做快速哈希 */
function hashSvgContent(svg: string): Uint8Array {
  // 去掉 lilith-sig 注释
  const body = svg.replace(/<!--\s*lilith-sig:[\s\S]*?-->/g, '')
  
  // FNV-1a 64-bit（用两个 32-bit 模拟）
  let h0 = 0xcbf29ce4 >>> 0
  let h1 = 0x84222325 >>> 0
  
  for (let i = 0; i < body.length; i += 1) {
    const b = body.charCodeAt(i) & 0xff
    h0 = Math.imul(h0 ^ b, 0x01000193) >>> 0
    h1 = Math.imul((h1 ^ b) + h0, 0x01000193) >>> 0
  }
  
  // 取 8 字节输出
  const out = new Uint8Array(8)
  out[0] = (h0 >>> 24) & 0xff
  out[1] = (h0 >>> 16) & 0xff
  out[2] = (h0 >>> 8) & 0xff
  out[3] = h0 & 0xff
  out[4] = (h1 >>> 24) & 0xff
  out[5] = (h1 >>> 16) & 0xff
  out[6] = (h1 >>> 8) & 0xff
  out[7] = h1 & 0xff
  
  return out
}

/**
 * 快速检查 ImageData 中是否有水印（魔数匹配 + CRC 校验）。
 * 不做完整的解扩解码，只是快速判断。
 * 
 * 注意：此函数为客户端同步检查预留，当前由后端 API 完成验证。
 */
export async function hasWatermarkQuick(
  imageData: ImageData,
  sigHash: Uint8Array,
  options?: { spreadFactor?: number; marginPixels?: number },
): Promise<boolean> {
  const { extractWatermark } = await import('./embed')
  const result = extractWatermark(imageData, sigHash, options)
  return result.found
}
