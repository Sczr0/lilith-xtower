/**
 * PNG 元数据注入 — 将 lilith-sig 签名写入 PNG tEXt 块
 *
 * PNG 文件结构：
 *   [8B signature] [IHDR] [other chunks] [IDAT...] [IEND]
 *
 * 在 IDAT 之前插入一个 tEXt 块：
 *   Keyword: "lilith-sig\0"
 *   Text:    原始 lilith-sig 注释文本
 *
 * 这样验证端只需读 tEXt → 解析 sigHash → 种子 PRNG → 提取 LSB 水印
 */

// PNG 签名
const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

// CRC-32 查表
const CRC_TABLE: number[] = []
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  CRC_TABLE[n] = c
}

function crc32(data: Uint8Array, offset: number, length: number): number {
  let crc = 0xffffffff
  for (let i = 0; i < length; i += 1) {
    crc = CRC_TABLE[(crc ^ data[offset + i]!) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function writeUint32BE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 24) & 0xff
  buf[offset + 1] = (value >>> 16) & 0xff
  buf[offset + 2] = (value >>> 8) & 0xff
  buf[offset + 3] = value & 0xff
}

/**
 * 从 PNG Blob 中提取 tEXt 块（keyword="lilith-sig"）
 * 返回文本内容，或 null
 */
export function extractPngTextChunk(pngBuffer: ArrayBuffer, keyword: string): string | null {
  const data = new Uint8Array(pngBuffer)

  // 校验 PNG 签名
  for (let i = 0; i < 8; i += 1) {
    if (data[i] !== PNG_SIG[i]!) return null
  }

  let offset = 8
  const kwBytes = new TextEncoder().encode(keyword + '\0')

  while (offset + 12 <= data.length) {
    const len = (data[offset]! << 24) | (data[offset + 1]! << 16) | (data[offset + 2]! << 8) | data[offset + 3]!
    const type = String.fromCharCode(
      data[offset + 4]!, data[offset + 5]!, data[offset + 6]!, data[offset + 7]!,
    )

    if (type === 'IEND') break

    if (type === 'tEXt' && len >= kwBytes.length) {
      const chunkData = data.subarray(offset + 8, offset + 8 + len)
      // 比对 keyword
      let match = true
      for (let i = 0; i < kwBytes.length; i += 1) {
        if (chunkData[i] !== kwBytes[i]!) { match = false; break }
      }
      if (match) {
        // keyword 匹配，提取后面的文本（跳过 keyword + \0）
        return new TextDecoder().decode(chunkData.subarray(kwBytes.length))
      }
    }

    offset += 12 + len // 4B len + 4B type + N data + 4B CRC
  }

  return null
}

/**
 * 在 PNG Blob 中注入 tEXt 块（在 IDAT 之前）
 * 返回新的 Blob
 */
export function injectPngTextChunk(pngBlob: Blob, keyword: string, text: string): Blob {
  // 先转为 ArrayBuffer
  return new Blob(
    [pngBlob],
    { type: 'image/png' },
  )
}

/**
 * 同步版本：将 PNG ArrayBuffer 注入 tEXt 块，返回新的 ArrayBuffer
 */
export function injectPngTextChunkSync(pngBuffer: ArrayBuffer, keyword: string, text: string): ArrayBuffer {
  const src = new Uint8Array(pngBuffer)

  // 校验 PNG 签名
  for (let i = 0; i < 8; i += 1) {
    if (src[i] !== PNG_SIG[i]!) {
      throw new Error('不是有效的 PNG 文件')
    }
  }

  // 构造 tEXt 块数据: keyword + '\0' + text
  const kwEncoded = new TextEncoder().encode(keyword)
  const textEncoded = new TextEncoder().encode(text)
  const chunkData = new Uint8Array(kwEncoded.length + 1 + textEncoded.length)
  chunkData.set(kwEncoded, 0)
  chunkData[kwEncoded.length] = 0 // null terminator
  chunkData.set(textEncoded, kwEncoded.length + 1)

  // 构造完整 tEXt 块: [4B len] [4B "tEXt"] [data] [4B CRC]
  const typeBytes = new TextEncoder().encode('tEXt')
  const crcInput = new Uint8Array(4 + chunkData.length)
  crcInput.set(typeBytes, 0)
  crcInput.set(chunkData, 4)
  const crc = crc32(crcInput, 0, crcInput.length)

  const chunk = new Uint8Array(12 + chunkData.length)
  writeUint32BE(chunk, 0, chunkData.length)
  chunk.set(typeBytes, 4)
  chunk.set(chunkData, 8)
  writeUint32BE(chunk, 8 + chunkData.length, crc)

  // 找到 IDAT 块的位置
  let idatOffset = 8
  while (idatOffset + 8 <= src.length) {
    const type = String.fromCharCode(
      src[idatOffset + 4]!, src[idatOffset + 5]!,
      src[idatOffset + 6]!, src[idatOffset + 7]!,
    )
    if (type === 'IDAT') break
    if (type === 'IEND') break
    const len = (src[idatOffset]! << 24) | (src[idatOffset + 1]! << 16) | (src[idatOffset + 2]! << 8) | src[idatOffset + 3]!
    idatOffset += 12 + len
  }

  // 在 IDAT 前插入 tEXt 块
  const result = new Uint8Array(src.length + chunk.length)
  result.set(src.subarray(0, idatOffset), 0)
  result.set(chunk, idatOffset)
  result.set(src.subarray(idatOffset), idatOffset + chunk.length)

  return result.buffer
}

/**
 * 从 PNG ArrayBuffer 中提取 lilith-sig 注释文本
 */
export function extractLilithSigFromPng(pngBuffer: ArrayBuffer): string | null {
  return extractPngTextChunk(pngBuffer, 'lilith-sig')
}
