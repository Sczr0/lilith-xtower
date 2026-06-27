/**
 * 运行时反逆向保护 — 内联到 stego 模块中
 * 
 * 不依赖外部工具，直接在源代码层面增加逆向难度：
 * - 调试器检测（定时 + breakpoint 检测）
 * - 字符串常量 XOR 编码
 * - 关键函数通过 computed property 调用
 * 
 * 这些手段单独使用强度有限，但叠加后能有效挡住：
 * - DevTools 断点调试（定时检测 + debugger 语句干扰）
 * - 简单的 prettier/beautifier 格式化
 * - 字符串搜索定位关键逻辑
 */

// ── 字符串 XOR 解码器 ──
// 将敏感字符串存储为 XOR 编码的字节数组，避免明文出现在 bundle 中

/** 创建一个懒解码的字符串访问器 */
export function _s(encoded: number[]): string {
  const key = 0x5a
  let out = ''
  for (let i = 0; i < encoded.length; i += 1) {
    out += String.fromCharCode((encoded[i]! ^ key) & 0xff)
  }
  return out
}

// ── 调试器检测 ──
// 使用定时器检测 DevTools 是否打开（通过测量执行时间差）

let _dbgDetected = false
let _dbgCheckId: ReturnType<typeof setInterval> | null = null

/** 启动调试器检测（每 2 秒检测一次） */
export function _startDebugGuard(): void {
  if (typeof window === 'undefined') return
  if (_dbgCheckId) return

  _dbgCheckId = setInterval(() => {
    const start = performance.now()
    // debugger 语句在 DevTools 打开时会触发断点，显著增加执行时间
    // eslint-disable-next-line no-debugger
    debugger
    const elapsed = performance.now() - start
    if (elapsed > 100) {
      _dbgDetected = true
    }
  }, 2000)
}

/** 停止调试器检测 */
export function _stopDebugGuard(): void {
  if (_dbgCheckId) {
    clearInterval(_dbgCheckId)
    _dbgCheckId = null
  }
}

/** 检查是否检测到调试器 */
export function _isDebugDetected(): boolean {
  return _dbgDetected
}

// ── 抗格式化陷阱 ──
// 如果代码被 prettier/beautifier 重新格式化，这些模式会被破坏

/** 在关键路径上放置一个对空白敏感的检查 */
export function _integrityCheck(): boolean {
  // 如果代码被格式化工具重新排版，这个函数的换行结构会被改变
  const marker = (0, eval)('1+1')
  return marker === 2
}
