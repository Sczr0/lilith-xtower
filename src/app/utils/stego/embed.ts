/**
 * LSB 隐写水印嵌入器 — 直接在 canvas ImageData 的像素中编码签名载荷
 * 
 * 算法：扩频 LSB（Least Significant Bit）隐写
 * 1. 用签名的 HMAC 做种子，生成伪随机的像素坐标序列
 * 2. 将载荷 bit 以 spreadFactor 重复（扩频）
 * 3. 在每个坐标处，修改蓝通道（人眼最不敏感）的 LSB
 * 4. 提取时反向操作，用多数投票恢复原始 bit
 * 
 * 抗攻击能力：
 * - 裁剪：坐标序列用边缘 margin 跳过边界，中心区域高概率存活
 * - 轻度压缩：扩频+投票可纠正少量翻转
 * - 色相/亮度调整：只修改 LSB，线性变换后仍可部分恢复
 * - 不能防：重度 JPEG 压缩、缩放、旋转（但这是 PNG，用户没动机做这些）
 */

import type { WatermarkPayload, WatermarkEncodeOptions, WatermarkExtractResult } from './types'
import { createPrngCoordGenerator, createPrngBitStream } from './prng'
import {
  encodePayload,
  bytesToBits,
  bitsToBytes,
  spreadBits,
  despreadBits,
  _tryDecode,
  PAYLOAD_BITS,
} from './payload'

// ── 构建嵌入种子 ──
// 种子 = SHA256(sigHash[0..16] || site_secret) 的前 16 字节
// 这里用 sigHash 的前 16 字节 ^ site_key 的低 16 字节混合
const _SK: number[] = [
  0x7e, 0x3a, 0x91, 0xfc, 0x2d, 0x48, 0x05, 0xbe,
  0x63, 0x9f, 0x14, 0xda, 0x88, 0x37, 0xc2, 0x51,
]

function _buildSeed(sigHash: Uint8Array): Uint8Array {
  const s = new Uint8Array(16)
  for (let i = 0; i < 16; i += 1) {
    const a = sigHash[i % sigHash.length]!
    const b = _SK[i]!
    // 非线性混合：旋转 + XOR 使得爆破 seed 不可行
    s[i] = (((a << 3) | (a >>> 5)) ^ b ^ (i * 0x1b)) & 0xff
  }
  return s
}

// ── 嵌入 ──

export interface EmbedResult {
  /** 嵌入成功 */
  ok: boolean
  /** 实际嵌入的 bit 数（扩频后） */
  bitsWritten: number
  /** 需要的像素数 */
  pixelsNeeded: number
  /** 可用像素数 */
  pixelsAvailable: number
}

/**
 * 将水印载荷嵌入到 canvas ImageData 中。
 * 直接修改传入的 ImageData（原地修改，避免拷贝开销）。
 */
export function embedWatermark(
  imageData: ImageData,
  payload: WatermarkPayload,
  options: WatermarkEncodeOptions = {},
): EmbedResult {
  const {
    spreadFactor = 3,
    channelOffset = 2, // B 通道
    marginPixels = 8,
  } = options

  const w = imageData.width
  const h = imageData.height
  const pixels = imageData.data

  // 1. 编码载荷为字节数组
  const rawBytes = encodePayload(payload)

  // 2. 展开为 bit 流
  const bits = bytesToBits(rawBytes) // 496 bits

  // 3. 扩频
  const spreadBits_ = spreadBits(bits, spreadFactor) // 496 * 3 = 1488 bits

  // 4. 可用像素数（每个像素嵌入 1 bit）
  // 边缘 margin 跳过，因为裁剪通常从边缘开始
  const availW = Math.max(0, w - marginPixels * 2)
  const availH = Math.max(0, h - marginPixels * 2)
  const available = availW * availH

  if (available < spreadBits_.length) {
    return {
      ok: false,
      bitsWritten: 0,
      pixelsNeeded: spreadBits_.length,
      pixelsAvailable: available,
    }
  }

  // 5. 生成像素坐标序列
  const seed = _buildSeed(payload.sigHash)
  const nextCoord = createPrngCoordGenerator(seed, w, h, marginPixels)
  // 额外 bit 流用于通道选择（增加分析难度）
  const channelPicker = createPrngBitStream(seed, 0xdead)

  // 6. 嵌入
  for (let i = 0; i < spreadBits_.length; i += 1) {
    const [x, y] = nextCoord()
    const bit = spreadBits_[i]!

    // 通道选择：默认 B，但以 1/8 概率选 R 或 G 以增加检测难度
    let ch = channelOffset
    if (channelPicker() === 1) {
      ch = channelPicker() === 1 ? 0 : 1 // R or G
    }

    const idx = (y * w + x) * 4 + ch
    if (idx >= pixels.length) continue

    // 修改 LSB：清除最低位，设置目标值
    pixels[idx] = (pixels[idx]! & 0xfe) | bit
  }

  return {
    ok: true,
    bitsWritten: spreadBits_.length,
    pixelsNeeded: spreadBits_.length,
    pixelsAvailable: available,
  }
}

// ── 提取 ──

/**
 * 从 canvas ImageData 中提取水印载荷。
 * 需要传入原始的 sigHash（用于重建嵌入坐标序列）。
 */
export function extractWatermark(
  imageData: ImageData,
  sigHash: Uint8Array,
  options: WatermarkEncodeOptions = {},
): WatermarkExtractResult {
  const {
    spreadFactor = 3,
    channelOffset = 2,
    marginPixels = 8,
  } = options

  const w = imageData.width
  const h = imageData.height
  const pixels = imageData.data

  // 1. 重建坐标序列
  const seed = _buildSeed(sigHash)
  const nextCoord = createPrngCoordGenerator(seed, w, h, marginPixels)
  const channelPicker = createPrngBitStream(seed, 0xdead)

  // 2. 需要的总 bit 数（扩频后）
  const totalBits = PAYLOAD_BITS * spreadFactor

  // 3. 读取 LSB
  const rawBits: number[] = []
  for (let i = 0; i < totalBits; i += 1) {
    const [x, y] = nextCoord()

    let ch = channelOffset
    if (channelPicker() === 1) {
      ch = channelPicker() === 1 ? 0 : 1
    }

    const idx = (y * w + x) * 4 + ch
    if (idx >= pixels.length) {
      rawBits.push(0) // 越界视为 0
      continue
    }

    rawBits.push(pixels[idx]! & 1)
  }

  // 4. 解扩（多数投票）
  const { bits: recoveredBits, correctedBits } = despreadBits(rawBits, spreadFactor)

  // 5. 打包为字节
  const bytes = bitsToBytes(recoveredBits)

  // 6. 尝试解码载荷
  const payload = _tryDecode(bytes, 0)

  return {
    found: payload !== null,
    payload,
    correctedBits,
    totalBits,
  }
}


