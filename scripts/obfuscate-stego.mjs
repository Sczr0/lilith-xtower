/**
 * 隐写水印模块的 build-time 混淆脚本
 *
 * 使用 javascript-obfuscator 对 .next/static/chunks 中包含 stego 代码的 JS chunk 进行深度混淆。
 * 在 `next build` 完成后由 postbuild 自动执行。
 *
 * 如果 javascript-obfuscator 未安装（非生产环境），优雅跳过。
 *
 * 安装: pnpm add -D javascript-obfuscator
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NEXT_STATIC = resolve(__dirname, '..', '.next', 'static', 'chunks')

const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,   // 适中：太高的阈值会让简单函数也变得巨大
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.1,       // 降低：死代码是体积膨胀的主要来源
  debugProtection: false,
  debugProtectionInterval: 0,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,                    // 保留：格式化代码后无法运行
  simplify: true,
  splitStrings: false,                    // 关闭：字符串拆分导致大量额外代码
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.5,
  stringArrayEncoding: ['rc4'],           // RC4 加密所有字符串字面量
  stringArrayIndexesType: ['hexadecimal-number'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,            // 减少包装层数
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 3,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.5,              // 降低：只加密 50% 的字符串
  transformObjectKeys: true,
  unicodeEscapeSequence: false,           // 关闭：unicode 转义不增加安全性，只增加体积
}

function findChunkFiles(dir) {
  const files = []
  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isFile() && entry.endsWith('.js')) {
        files.push(full)
      } else if (stat.isDirectory()) {
        files.push(...findChunkFiles(full))
      }
    }
  } catch {
    // 目录不存在
  }
  return files
}

/**
 * 判断 chunk 是否值得混淆。
 * 
 * 策略：只混淆 stego 代码密度高的 chunk。
 * - 如果 chunk 中 stego 特有标识符出现次数 >= MIN_OCCURRENCES，说明 stego 代码占比足够大
 * - 避免混淆 React/echarts 等庞大共享依赖的 chunk（那种 chunk 里 stego 只有一个 import 语句）
 */
const STEGO_SIGNATURES = [
  'buildPayloadFromSignature',
  'embedWatermark',
  'extractWatermark',
  'createPrngCoordGenerator',
  'spreadBits',
  'despreadBits',
  'encodePayload',
  '_buildSeed',
]

const MIN_OCCURRENCES = 3

function countStegoSignatures(content) {
  let count = 0
  for (const sig of STEGO_SIGNATURES) {
    let idx = 0
    while ((idx = content.indexOf(sig, idx)) !== -1) {
      count += 1
      idx += sig.length
    }
  }
  return count
}

function containsStegoCode(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8')
    return countStegoSignatures(content) >= MIN_OCCURRENCES
  } catch {
    return false
  }
}

function computeHash(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 8)
}

async function main() {
  let JavaScriptObfuscator
  try {
    JavaScriptObfuscator = (await import('javascript-obfuscator')).default
  } catch {
    console.warn('[obfuscate-stego] javascript-obfuscator not found. Skipping.')
    console.warn('[obfuscate-stego] Install: pnpm add -D javascript-obfuscator')
    return
  }

  console.log('[obfuscate-stego] Scanning for stego chunks in', NEXT_STATIC)

  const allFiles = findChunkFiles(NEXT_STATIC)
  const stegoFiles = allFiles.filter(containsStegoCode)

  if (stegoFiles.length === 0) {
    console.log('[obfuscate-stego] No stego chunks found. (stego code may be inlined into other chunks or unused)')
    return
  }

  console.log(`[obfuscate-stego] Found ${stegoFiles.length} stego chunk(s) to obfuscate`)

  let totalOriginal = 0
  let totalObfuscated = 0

  for (const filePath of stegoFiles) {
    const original = readFileSync(filePath, 'utf-8')
    const originalSize = Buffer.byteLength(original, 'utf-8')
    totalOriginal += originalSize
    const originalHash = computeHash(original)

    try {
      const result = JavaScriptObfuscator.obfuscate(original, OBFUSCATOR_OPTIONS)
      const obfuscated = result.getObfuscatedCode()
      const obfuscatedSize = Buffer.byteLength(obfuscated, 'utf-8')
      totalObfuscated += obfuscatedSize

      writeFileSync(filePath + '.bak', original)
      writeFileSync(filePath, obfuscated)

      const relPath = filePath.replace(NEXT_STATIC + '/', '').replace(NEXT_STATIC + '\\', '')
      console.log(
        `  OK ${relPath} ` +
        `[${originalHash}] ` +
        `${(originalSize / 1024).toFixed(1)}KB -> ${(obfuscatedSize / 1024).toFixed(1)}KB ` +
        `(${Math.round((obfuscatedSize / originalSize) * 100)}%)`
      )
    } catch (err) {
      console.error(`  FAIL ${filePath}:`, err.message)
    }
  }

  console.log(
    `[obfuscate-stego] Done. ` +
    `${(totalOriginal / 1024).toFixed(1)}KB -> ${(totalObfuscated / 1024).toFixed(1)}KB ` +
    `(${Math.round((totalObfuscated / Math.max(1, totalOriginal)) * 100)}%)`
  )
}

main().catch((err) => {
  console.error('[obfuscate-stego] Fatal error:', err)
  process.exit(1)
})
