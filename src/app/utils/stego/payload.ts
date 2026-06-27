/**
 * 水印载荷的编解码 — 将结构化数据序列化为二进制载荷
 * 
 * 载荷布局（80 字节 / 640 bits）：
 * ┌────────┬─────────┬──────────┬────────────┬──────────┬──────────────┬──────────┐
 * │ magic  │ version │ payload  │ sigHash    │ timestamp│ userId       │ content  │
 * │ 4B     │ 1B      │ len 1B   │ 32B        │ 4B(u32)  │ 8B           │ Hash 8B  │
 * └────────┴─────────┴──────────┴────────────┴──────────┴──────────────┴──────────┘
 * 
 * 之后附加 2 字节 CRC-16/Modbus 校验
 * 总载荷: 60 + 2 = 62 字节 = 496 bits
 */

import type { WatermarkPayload } from './types'

// ── 魔数（嵌入时写入，提取时校验）──
// 使用非可打印字节 + 变体，避免被文本编辑器误显示
const _M0 = 0xfc
const _M1 = 0xa7
const _M2 = 0x03
const _M3 = 0xe1

const MAGIC = ((_M0 << 24) | (_M1 << 16) | (_M2 << 8) | _M3) >>> 0

const VERSION = 1

/** 单次载荷的总 bit 数 */
const PAYLOAD_BITS = 496
/** 载荷字节数（不含校验的原始数据） */
const RAW_BYTES = 60

// ── CRC-16/Modbus（查表法，紧凑）──
const _T: number[] = []
for (let _i = 0; _i < 256; _i += 1) {
  let _c = _i
  for (let _j = 0; _j < 8; _j += 1) {
    _c = _c & 1 ? (_c >>> 1) ^ 0xa001 : _c >>> 1
  }
  _T[_i] = _c
}

function _crc16(data: Uint8Array, offset: number, length: number): number {
  let crc = 0xffff
  for (let i = 0; i < length; i += 1) {
    crc = (crc >>> 8) ^ _T[(crc ^ data[offset + i]!)! & 0xff]!
  }
  return crc & 0xffff
}

// ── 编码 ──

export function encodePayload(payload: WatermarkPayload): Uint8Array {
  const buf = new Uint8Array(RAW_BYTES + 2) // 60 数据 + 2 CRC

  // magic (4B)
  buf[0] = (MAGIC >>> 24) & 0xff
  buf[1] = (MAGIC >>> 16) & 0xff
  buf[2] = (MAGIC >>> 8) & 0xff
  buf[3] = MAGIC & 0xff

  // version (1B)
  buf[4] = VERSION & 0xff

  // 保留 (1B) — 未来可用于水印强度/算法选择
  buf[5] = 0

  // sigHash (32B)
  const sh = payload.sigHash
  const shLen = Math.min(sh.length, 32)
  for (let i = 0; i < shLen; i += 1) buf[6 + i] = sh[i]!
  // 不足 32 字节补零
  for (let i = shLen; i < 32; i += 1) buf[6 + i] = 0

  // timestamp (4B, big-endian u32)
  const ts = payload.timestamp >>> 0
  buf[38] = (ts >>> 24) & 0xff
  buf[39] = (ts >>> 16) & 0xff
  buf[40] = (ts >>> 8) & 0xff
  buf[41] = ts & 0xff

  // userId (8B ASCII, 右补零)
  const uid = payload.userId
  const uidLen = Math.min(uid.length, 8)
  for (let i = 0; i < uidLen; i += 1) buf[42 + i] = uid[i]!
  for (let i = uidLen; i < 8; i += 1) buf[42 + i] = 0

  // contentHash (8B)
  const ch = payload.contentHash
  const chLen = Math.min(ch.length, 8)
  for (let i = 0; i < chLen; i += 1) buf[50 + i] = ch[i]!
  for (let i = chLen; i < 8; i += 1) buf[50 + i] = 0

  // 剩余字节保留（未来扩展）
  for (let i = 58; i < RAW_BYTES; i += 1) buf[i] = 0

  // CRC-16
  const crc = _crc16(buf, 0, RAW_BYTES)
  buf[RAW_BYTES] = (crc >>> 8) & 0xff
  buf[RAW_BYTES + 1] = crc & 0xff

  return buf
}

// ── 解码 ──

function _tryDecode(buf: Uint8Array, offset: number): WatermarkPayload | null {
  // 校验 magic
  const m = ((buf[offset]! << 24) | (buf[offset + 1]! << 16) | (buf[offset + 2]! << 8) | buf[offset + 3]!) >>> 0
  if (m !== MAGIC) return null

  // 校验 CRC
  const expectedCrc = _crc16(buf, offset, RAW_BYTES)
  const actualCrc = ((buf[offset + RAW_BYTES]! << 8) | buf[offset + RAW_BYTES + 1]!) & 0xffff
  if (expectedCrc !== actualCrc) return null

  const sh = buf.slice(offset + 6, offset + 38) // 32B
  const ts = ((buf[offset + 38]! << 24) | (buf[offset + 39]! << 16) | (buf[offset + 40]! << 8) | buf[offset + 41]!) >>> 0
  const uid = buf.slice(offset + 42, offset + 50) // 8B
  const ch = buf.slice(offset + 50, offset + 58) // 8B

  return {
    magic: MAGIC,
    version: buf[offset + 4]!,
    sigHash: sh,
    timestamp: ts,
    userId: uid,
    contentHash: ch,
  }
}

// ── bits <-> bytes 转换 ──

/** 将 Uint8Array 展开为 bit 数组（MSB first per byte） */
export function bytesToBits(data: Uint8Array): number[] {
  const bits: number[] = []
  for (let i = 0; i < data.length; i += 1) {
    const byte = data[i]!
    for (let j = 7; j >= 0; j -= 1) {
      bits.push((byte >>> j) & 1)
    }
  }
  return bits
}

/** 将 bit 数组打包回 Uint8Array（MSB first per byte） */
export function bitsToBytes(bits: number[]): Uint8Array {
  const len = Math.ceil(bits.length / 8)
  const buf = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) {
    let byte = 0
    for (let j = 0; j < 8; j += 1) {
      const bitIdx = i * 8 + j
      if (bitIdx < bits.length) {
        byte = (byte << 1) | (bits[bitIdx]! & 1)
      }
    }
    buf[i] = byte
  }
  return buf
}

/**
 * 扩频编码：将每个 bit 重复 spreadFactor 次。
 * 提取时用多数投票恢复。
 */
export function spreadBits(bits: number[], spreadFactor: number): number[] {
  const out: number[] = []
  for (const b of bits) {
    for (let i = 0; i < spreadFactor; i += 1) {
      out.push(b)
    }
  }
  return out
}

/**
 * 解扩：对每 spreadFactor 个 bit 做多数投票，恢复原始 bit。
 * 返回 { bits, correctedBits } — correctedBits 是经过投票纠正的 bit 数。
 */
export function despreadBits(rawBits: number[], spreadFactor: number): { bits: number[]; correctedBits: number } {
  const out: number[] = []
  let corrected = 0
  const groups = Math.floor(rawBits.length / spreadFactor)

  for (let i = 0; i < groups; i += 1) {
    let ones = 0
    for (let j = 0; j < spreadFactor; j += 1) {
      if (rawBits[i * spreadFactor + j]! === 1) ones += 1
    }
    const majority = ones > spreadFactor / 2 ? 1 : 0
    out.push(majority)
    // 纠正数 = 少数派的数量
    corrected += majority === 1 ? (spreadFactor - ones) : ones
  }

  return { bits: out, correctedBits: corrected }
}

export { MAGIC, VERSION, PAYLOAD_BITS, RAW_BYTES, _tryDecode }
