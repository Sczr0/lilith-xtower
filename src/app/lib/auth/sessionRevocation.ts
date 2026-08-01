/**
 * 会话撤销存储 — 进程内存表 + 文件持久化。
 *
 * 背景：撤销表此前仅为进程内存 Map，PM2 reload / 进程重启后会丢失，
 * 导致已登出的 Cookie 在重启后「复活」；cluster 多实例下撤销记录
 * 也无法跨 worker 共享（需配合 PM2 instances: 1）。
 *
 * 设计（单机部署模型）：
 * - 读路径永不落盘：isAuthSessionRevoked 只查内存 Map，无磁盘 IO。
 * - 写路径：500ms 防抖 + 串行化（writeChain）+ tmp 文件原子 rename。
 * - 加载：惰性（首次调用时）、容错（损坏/超大文件隔离为 .corrupt-<ts>）。
 * - 写盘时先清理过期项，文件自限容，不会无限增长。
 * - 进程退出时同步兜底刷盘（PM2 reload 场景）。
 * - 测试/开发环境（NODE_ENV !== 'production' 且未显式配置路径）为纯内存，
 *   与旧版行为一致，现有测试零改动。
 *
 * 存储位置：默认 /var/lib/lilith-xtower/revocations.json（部署目录外，
 * 避免被部署脚本 rsync --delete 清空）；可用 AUTH_SESSION_REVOCATION_FILE 覆盖。
 */

import fs from 'fs'
import path from 'path'

type SessionRevocationStore = Map<string, number>

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 防御：撤销表正常仅几 KB，超过视为异常
const WRITE_DEBOUNCE_MS = 500
const DEFAULT_PROD_FILE = path.join('/', 'var', 'lib', 'lilith-xtower', 'revocations.json')

const revocationStore: SessionRevocationStore = new Map()

const REVOCATION_FILE =
  (process.env.AUTH_SESSION_REVOCATION_FILE || '').trim() ||
  (process.env.NODE_ENV === 'production' ? DEFAULT_PROD_FILE : '')

let loaded = false
let writeTimer: NodeJS.Timeout | null = null
let writeChain: Promise<void> = Promise.resolve()

function cleanupExpired(now: number): void {
  for (const [sessionKey, expireAt] of revocationStore.entries()) {
    if (expireAt <= now) {
      revocationStore.delete(sessionKey)
    }
  }
}

// ── 文件持久化 ──

/** 隔离损坏/异常文件（重命名保留现场），避免启动即崩溃。 */
function quarantineCorruptFile(): void {
  try {
    fs.renameSync(REVOCATION_FILE, `${REVOCATION_FILE}.corrupt-${Date.now()}`)
  } catch {
    // 隔离失败不致命
  }
}

/** 从磁盘加载撤销记录（惰性 + 容错；只保留未过期项）。 */
function loadFromDisk(): void {
  if (!REVOCATION_FILE || loaded) return
  loaded = true
  try {
    if (!fs.existsSync(REVOCATION_FILE)) return
    const stat = fs.statSync(REVOCATION_FILE)
    if (stat.size > MAX_FILE_BYTES) {
      quarantineCorruptFile()
      return
    }
    const raw = JSON.parse(fs.readFileSync(REVOCATION_FILE, 'utf8')) as Record<string, unknown>
    const now = Date.now()
    for (const [sessionKey, expireAt] of Object.entries(raw)) {
      if (typeof sessionKey !== 'string' || typeof expireAt !== 'number' || !Number.isFinite(expireAt)) {
        continue
      }
      if (expireAt > now) {
        revocationStore.set(sessionKey, expireAt)
      }
    }
  } catch (error) {
    quarantineCorruptFile()
    console.error('[sessionRevocation] 加载撤销记录失败，已隔离文件:', error)
  }
}

/** 写盘：tmp 文件 + 原子 rename；串行化避免交错写坏文件。 */
function persistToDisk(): void {
  if (!REVOCATION_FILE) return
  cleanupExpired(Date.now())
  const data = JSON.stringify(Object.fromEntries(revocationStore.entries()))
  writeChain = writeChain
    .then(async () => {
      await fs.promises.mkdir(path.dirname(REVOCATION_FILE), { recursive: true })
      const tmp = `${REVOCATION_FILE}.tmp`
      await fs.promises.writeFile(tmp, data, 'utf8')
      await fs.promises.rename(tmp, REVOCATION_FILE)
    })
    .catch((error) => {
      console.error('[sessionRevocation] 写入撤销记录失败:', error)
    })
}

/** 防抖调度：连续登出只写一次盘。 */
function schedulePersist(): void {
  if (!REVOCATION_FILE) return
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    writeTimer = null
    persistToDisk()
  }, WRITE_DEBOUNCE_MS)
}

// 进程退出兜底：未及防抖完成的写在此同步刷盘（PM2 reload 场景）
const IS_BUILD_PHASE = process.env.NEXT_PHASE === 'phase-production-build'
if (REVOCATION_FILE && !IS_BUILD_PHASE) {
  process.on('exit', () => {
    if (writeTimer) {
      clearTimeout(writeTimer)
      writeTimer = null
    }
    try {
      fs.mkdirSync(path.dirname(REVOCATION_FILE), { recursive: true })
      const tmp = `${REVOCATION_FILE}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(revocationStore.entries())), 'utf8')
      fs.renameSync(tmp, REVOCATION_FILE)
    } catch {
      // 退出兜底失败不影响进程退出
    }
  })
}

// ── 公开 API ──

export function revokeAuthSession(sessionKey: string, ttlMs: number): void {
  const normalizedKey = sessionKey.trim()
  if (!normalizedKey || ttlMs <= 0) return

  loadFromDisk()
  const now = Date.now()
  cleanupExpired(now)
  revocationStore.set(normalizedKey, now + ttlMs)
  schedulePersist()
}

export function isAuthSessionRevoked(sessionKey: string): boolean {
  const normalizedKey = sessionKey.trim()
  if (!normalizedKey) return false

  loadFromDisk()
  const now = Date.now()
  cleanupExpired(now)

  const expireAt = revocationStore.get(normalizedKey)
  if (!expireAt) return false

  if (expireAt <= now) {
    revocationStore.delete(normalizedKey)
    return false
  }

  return true
}

/**
 * 仅用于单元测试：重置内存中的撤销记录。
 * 同时取消未落盘的防抖写，避免测试间相互污染。
 */
export function resetAuthSessionRevocationsForTest(): void {
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = null
  }
  revocationStore.clear()
  loaded = false
}
