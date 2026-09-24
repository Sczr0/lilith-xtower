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
 * 注意：调试器检测（guard）需显式启动，不再随模块导入自动激活。
 * 原因：guard 的检测结果（_isDebugDetected）当前无任何消费方，自动启动只会留下
 * 一个永不清理的 2s 定时器（内含 debugger，DevTools 打开时每 2s 冻结页面）。
 * 若将来要真正启用反调试，请在具体使用水印的组件里按生命周期 _startDebugGuard()/_stopDebugGuard()。
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

// 运行时保护：导出但不再自动启动（见文件头说明），由调用方按生命周期显式启停。
export { _startDebugGuard, _stopDebugGuard, _isDebugDetected } from './guard'
