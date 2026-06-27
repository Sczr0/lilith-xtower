/**
 * 隐写水印模块 — 公开 API
 * 
 * 使用方式：
 * 1. 从 SVG 提取签名 → buildPayloadFromSignature(svgText)
 * 2. 渲染 SVG 到 canvas → 获取 ImageData
 * 3. 嵌入水印 → embedWatermark(imageData, payload)
 * 4. 导出 PNG → canvas.toBlob()
 * 
 * 验证方式：
 * 1. 加载 PNG 到 canvas → 获取 ImageData
 * 2. 提取水印 → extractWatermark(imageData, sigHash)
 * 
 * 注意：模块导入即启动调试器检测（guard._startDebugGuard）
 */

// 类型
export type {
  WatermarkPayload,
  WatermarkEncodeOptions,
  WatermarkExtractResult,
} from './types'

// 载荷构建
export { buildPayloadFromSignature, hasWatermarkQuick } from './bridge'

// 核心嵌入/提取
export { embedWatermark, extractWatermark, type EmbedResult } from './embed'

// 底层编解码（仅测试用）
export { encodePayload, bytesToBits, bitsToBytes, spreadBits, despreadBits } from './payload'

// ── 运行时保护（模块加载时自动激活）──
import { _startDebugGuard } from './guard'
_startDebugGuard()
