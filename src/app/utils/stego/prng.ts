/**
 * 扩频水印专用 PRNG — Mulberry32 + SplitMix32
 * 
 * 为什么手写不用 crypto.getRandomValues：
 * - 需要确定性：同一个 seed 必须产生相同的像素位置序列（嵌入/提取对称）
 * - 性能：每张图可能需要生成数千个坐标，Math.random 太慢且不可控
 * - 混淆友好：纯算术运算的 PRNG 经过 js-obfuscator 后会变得更不可读
 */

/** Mulberry32: 32-bit state, 2^32 period, 比 xoshiro 更紧凑 */
function _m32(s: number): number {
  // 内部函数名经过 build-time 混淆后不可搜索
  let z = (s | 0) >>> 0
  z = Math.imul((z ^ (z >>> 15)), 0x85ebca6b) >>> 0
  z = Math.imul((z ^ (z >>> 13)), 0xc2b2ae35) >>> 0
  z = (z ^ (z >>> 16)) >>> 0
  return z
}

/** 将 4 字节 Uint8Array 转为 u32 seed */
function _b2u(b: Uint8Array, offset: number): number {
  return (
    ((b[offset]! << 24) | (b[offset + 1]! << 16) | (b[offset + 2]! << 8) | b[offset + 3]!) >>> 0
  )
}

/** 将任意 Uint8Array 通过 SplitMix64 压缩为单个 32-bit seed */
function _h2s(data: Uint8Array): number {
  let h = 0x811c9dc5 >>> 0
  for (let i = 0; i < data.length; i += 1) {
    h = Math.imul(h ^ (data[i]! & 0xff), 0x01000193) >>> 0
  }
  // SplitMix64 风格的最终化（只取低 32 位）
  h = Math.imul((h ^ (h >>> 16)), 0x85ebca6b) >>> 0
  h = Math.imul((h ^ (h >>> 13)), 0xc2b2ae35) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

/**
 * 创建一个确定性的伪随机坐标序列生成器。
 * 
 * @param seedBytes 种子字节（通常来自签名的 HMAC 前缀）
 * @param imgWidth 图像宽度（像素）
 * @param imgHeight 图像高度（像素）
 * @param marginPixels 边缘跳过像素数
 * @returns 一个迭代器函数，每次调用返回 [x, y]
 */
export function createPrngCoordGenerator(
  seedBytes: Uint8Array,
  imgWidth: number,
  imgHeight: number,
  marginPixels: number,
): () => [number, number] {
  const seed = _h2s(seedBytes)
  // 使用两个独立的 m32 实例：一个用于 x，一个用于 y（交错混入防止关联）
  let sx = (seed ^ 0x9e3779b9) >>> 0
  let sy = (seed ^ 0x7f4a7c13) >>> 0
  
  const minX = marginPixels
  const maxX = imgWidth - marginPixels - 1
  const minY = marginPixels
  const maxY = imgHeight - marginPixels - 1
  const rangeX = maxX - minX + 1
  const rangeY = maxY - minY + 1

  if (rangeX <= 0 || rangeY <= 0) {
    // 图像太小，回退到全图
    return () => [
      (_m32(sx = ((sx + 0x9e3779b9) >>> 0)) % imgWidth),
      (_m32(sy = ((sy + 0x7f4a7c13) >>> 0)) % imgHeight),
    ]
  }

  return () => {
    // 每次调用交错更新两个状态
    sx = _m32(sx)
    sy = _m32((sy + sx) >>> 0)
    const x = minX + (sx % rangeX)
    const y = minY + (sy % rangeY)
    return [x, y]
  }
}

/**
 * 创建用于 bit 选择的 PRNG（返回 0 或 1）。
 * 用于决定修改 R/G/B 中哪个子通道，增加分析难度。
 */
export function createPrngBitStream(seedBytes: Uint8Array, offset: number): () => number {
  let s = (_h2s(seedBytes) ^ offset) >>> 0
  return () => {
    s = _m32(s)
    return (s >>> 24) & 1  // 取最高字节的最低位
  }
}
