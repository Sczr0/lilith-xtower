/**
 * 会话撤销存储 — 进程内存表 + 持久化（SQLite 优先，JSON 回退）。
 *
 * 背景：撤销表此前仅为进程内存 Map，PM2 reload / 进程重启后会丢失，
 * 导致已登出的 Cookie 在重启后「复活」；cluster 多实例下撤销记录
 * 也无法跨 worker 共享（需配合 PM2 instances: 1）。
 *
 * 设计（单机部署模型）：
 * - 读路径永不落盘：isAuthSessionRevoked / isCredentialRevoked 只查内存 Map，无磁盘 IO。
 * - 持久化后端按需惰性初始化，二选一：
 *   - sqlite（推荐）：node:sqlite 内建模块，ACID + 索引；撤销是低频操作，
 *     写路径立即 upsert（不再防抖）。
 *   - json：兼容旧版实现，防抖 + 串行化（writeChain）+ tmp 文件原子 rename。
 * - 加载：惰性（首次调用时）、容错（损坏/超大文件隔离为 .corrupt-<ts>）。
 * - 写盘时先清理过期项，存储自限容，不会无限增长。
 * - 进程退出时同步兜底刷盘（JSON）/ 关闭连接（SQLite）。
 * - 测试/开发环境（NODE_ENV !== 'production' 且未显式配置路径）为纯内存，
 *   与旧版行为一致，现有测试零改动。
 *
 * 两类记录：
 * - revocations：单会话撤销（key 形如 sid:<id> / legacy:<hash>）。子会话键 -> 过期时间。
 * - credential_revocations：凭证级水位线（key 形如 cred:<fingerprint>），用于「注销全部」。
 *   语义：无效化所有 issuedAt < invalidBefore 的会话，直到 expireAt。
 *   注意：线上权威的「注销全部」由上游后端负责（/auth/session/logout 返回 revokedJti /
 *   logoutBefore）；这里的水位线是本地纵深防御/未来 OAuth grant 树的基础设施。
 *
 * 环境变量：
 * - AUTH_SESSION_REVOCATION_DB：SQLite 路径（生产默认 /var/lib/lilith-xtower/revocations.db）
 * - AUTH_SESSION_REVOCATION_FILE：JSON 路径（生产默认 /var/lib/lilith-xtower/revocations.json）。
 *   首次启用 SQLite 时作为一次性导入源，导入成功后归档为 .imported-<ts>。
 * - AUTH_SESSION_REVOCATION_BACKEND：auto（默认）| sqlite | json
 *
 * 存储位置应置于部署目录之外，避免被部署脚本 rsync --delete 清空。
 */

import fs from 'fs'
import path from 'path'

// ── 类型 ──

type SessionRevocationStore = Map<string, number>
type CredentialRevocationRecord = { invalidBefore: number; expireAt: number }
type CredentialRevocationStore = Map<string, CredentialRevocationRecord>

type SqliteStatement = {
  run: (...params: unknown[]) => unknown
  get: (...params: unknown[]) => unknown
  all: (...params: unknown[]) => unknown[]
}

type SqliteDatabase = {
  exec: (sql: string) => void
  prepare: (sql: string) => SqliteStatement
  close: () => void
}

type SqliteModule = {
  DatabaseSync: new (file: string) => SqliteDatabase
}

type BackendKind = 'memory' | 'json' | 'sqlite'

type PersistedStore = {
  sessions: SessionRevocationStore
  credentials: CredentialRevocationStore
}

// ── 常量 ──

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 防御：撤销表正常仅几 KB，超过视为异常
const WRITE_DEBOUNCE_MS = 500
const DEFAULT_PROD_FILE = path.join('/', 'var', 'lib', 'lilith-xtower', 'revocations.json')
const DEFAULT_PROD_DB = path.join('/', 'var', 'lib', 'lilith-xtower', 'revocations.db')
/** JSON 持久化中凭证水位线的保留键（会话键均为 sid:/legacy: 前缀，不会冲突）。 */
const CREDENTIALS_KEY = '__credentials__'

const LEGACY_FILE =
  (process.env.AUTH_SESSION_REVOCATION_FILE || '').trim() ||
  (process.env.NODE_ENV === 'production' ? DEFAULT_PROD_FILE : '')

const DB_FILE =
  (process.env.AUTH_SESSION_REVOCATION_DB || '').trim() ||
  (process.env.NODE_ENV === 'production' ? DEFAULT_PROD_DB : '')

// ── 内存表 ──

const sessionStore: SessionRevocationStore = new Map()
const credentialStore: CredentialRevocationStore = new Map()

let loaded = false
let backendKind: BackendKind | null = null

// JSON 写路径状态
let writeTimer: NodeJS.Timeout | null = null
let writeChain: Promise<void> = Promise.resolve()

// SQLite 状态
let sqliteModule: SqliteModule | null = null
let sqliteProbed = false
let sqliteDb: SqliteDatabase | null = null

function cleanupExpired(now: number): void {
  for (const [sessionKey, expireAt] of sessionStore.entries()) {
    if (expireAt <= now) {
      sessionStore.delete(sessionKey)
    }
  }
  for (const [credentialKey, record] of credentialStore.entries()) {
    if (record.expireAt <= now) {
      credentialStore.delete(credentialKey)
    }
  }
}

// ── 后端选择 ──

/** 惰性探测 node:sqlite（不 import，避免 Node < 22.5 在构建期直接报错）。 */
function getSqliteModule(): SqliteModule | null {
  if (sqliteProbed) return sqliteModule
  sqliteProbed = true
  try {
    const getBuiltinModule = (process as unknown as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule
    if (typeof getBuiltinModule !== 'function') return null
    const mod = getBuiltinModule('node:sqlite') as SqliteModule | undefined
    sqliteModule = mod && typeof mod.DatabaseSync === 'function' ? mod : null
  } catch (error) {
    console.warn('[sessionRevocation] node:sqlite 不可用，将回退 JSON/内存:', error)
    sqliteModule = null
  }
  return sqliteModule
}

function resolveBackendKind(): BackendKind {
  const preference = (process.env.AUTH_SESSION_REVOCATION_BACKEND || 'auto').trim().toLowerCase()
  const hasDb = Boolean(DB_FILE)
  const hasLegacy = Boolean(LEGACY_FILE)

  if (preference === 'json') return hasLegacy ? 'json' : 'memory'

  if (preference === 'sqlite') {
    if (hasDb && getSqliteModule()) return 'sqlite'
    console.warn(
      `[sessionRevocation] AUTH_SESSION_REVOCATION_BACKEND=sqlite 不可用或未配置，回退到 ${hasLegacy ? 'JSON' : '内存'}`,
    )
    return hasLegacy ? 'json' : 'memory'
  }

  // auto：SQLite 可用则优先，否则回退 JSON，再否则纯内存
  if (hasDb && getSqliteModule()) return 'sqlite'
  if (hasDb) {
    console.warn(
      `[sessionRevocation] node:sqlite 不可用，回退到 ${hasLegacy ? 'JSON' : '内存'}（Node >= 22.5 可用；Node 22 可加 --experimental-sqlite）`,
    )
  }
  if (hasLegacy) return 'json'
  return 'memory'
}

// ── JSON 持久化 ──

/** 隔离损坏/异常文件（重命名保留现场），避免启动即崩溃。 */
function quarantineFile(file: string): void {
  try {
    fs.renameSync(file, `${file}.corrupt-${Date.now()}`)
  } catch {
    // 隔离失败不致命
  }
}

/**
 * 解析持久化 JSON。兼容两种格式：
 * - v1（旧）：扁平 `{ "<sessionKey>": expireAt }`；
 * - v2（当前）：扁平会话键 + 保留键 `__credentials__` 存放凭证水位线对象。
 */
function parsePersistedJson(raw: unknown): PersistedStore {
  const sessions: SessionRevocationStore = new Map()
  const credentials: CredentialRevocationStore = new Map()
  const now = Date.now()

  if (!raw || typeof raw !== 'object') return { sessions, credentials }
  const source = raw as Record<string, unknown>

  for (const [key, value] of Object.entries(source)) {
    if (key === CREDENTIALS_KEY) {
      if (!value || typeof value !== 'object') continue
      for (const [credentialKey, rawRecord] of Object.entries(value as Record<string, unknown>)) {
        if (!rawRecord || typeof rawRecord !== 'object') continue
        const record = rawRecord as Record<string, unknown>
        const invalidBefore = record.invalidBefore
        const expireAt = record.expireAt
        if (
          typeof invalidBefore === 'number' &&
          Number.isFinite(invalidBefore) &&
          typeof expireAt === 'number' &&
          Number.isFinite(expireAt) &&
          expireAt > now
        ) {
          credentials.set(credentialKey, { invalidBefore, expireAt })
        }
      }
      continue
    }
    if (typeof value === 'number' && Number.isFinite(value) && value > now) {
      sessions.set(key, value)
    }
  }

  return { sessions, credentials }
}

/** 读取 JSON 撤销文件（容错；只保留未过期项）。 */
function readPersistedJson(file: string): PersistedStore | null {
  try {
    if (!fs.existsSync(file)) return null
    const stat = fs.statSync(file)
    if (stat.size > MAX_FILE_BYTES) {
      quarantineFile(file)
      return null
    }
    return parsePersistedJson(JSON.parse(fs.readFileSync(file, 'utf8')) as unknown)
  } catch (error) {
    quarantineFile(file)
    console.error('[sessionRevocation] 加载撤销记录失败，已隔离文件:', error)
    return null
  }
}

function loadJsonFromDisk(): void {
  if (!LEGACY_FILE) return
  const persisted = readPersistedJson(LEGACY_FILE)
  if (!persisted) return
  for (const [sessionKey, expireAt] of persisted.sessions) {
    sessionStore.set(sessionKey, expireAt)
  }
  for (const [credentialKey, record] of persisted.credentials) {
    credentialStore.set(credentialKey, record)
  }
}

function serializeStores(): string {
  const credentials: Record<string, CredentialRevocationRecord> = {}
  for (const [credentialKey, record] of credentialStore.entries()) {
    credentials[credentialKey] = record
  }
  return JSON.stringify({
    ...Object.fromEntries(sessionStore.entries()),
    [CREDENTIALS_KEY]: credentials,
  })
}

/** 写盘：tmp 文件 + 原子 rename；串行化避免交错写坏文件。 */
function persistJsonToDisk(): void {
  if (!LEGACY_FILE) return
  cleanupExpired(Date.now())
  const data = serializeStores()
  writeChain = writeChain
    .then(async () => {
      await fs.promises.mkdir(path.dirname(LEGACY_FILE), { recursive: true })
      const tmp = `${LEGACY_FILE}.tmp`
      await fs.promises.writeFile(tmp, data, 'utf8')
      await fs.promises.rename(tmp, LEGACY_FILE)
    })
    .catch((error) => {
      console.error('[sessionRevocation] 写入撤销记录失败:', error)
    })
}

/** 防抖调度：连续登出只写一次盘。 */
function schedulePersistJson(): void {
  if (!LEGACY_FILE) return
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    writeTimer = null
    persistJsonToDisk()
  }, WRITE_DEBOUNCE_MS)
}

// ── SQLite 持久化 ──

function ensureSqlite(): SqliteDatabase | null {
  if (sqliteDb) return sqliteDb
  const mod = getSqliteModule()
  if (!mod || !DB_FILE) return null

  let db: SqliteDatabase | null = null
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true })
    db = new mod.DatabaseSync(DB_FILE)
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA busy_timeout = 5000')
    db.exec('PRAGMA synchronous = NORMAL')
    db.exec('CREATE TABLE IF NOT EXISTS revocations (key TEXT PRIMARY KEY, expire_at INTEGER NOT NULL)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_revocations_expire ON revocations(expire_at)')
    db.exec(
      'CREATE TABLE IF NOT EXISTS credential_revocations (credential_id TEXT PRIMARY KEY, invalid_before INTEGER NOT NULL, expire_at INTEGER NOT NULL)',
    )
    db.exec('CREATE INDEX IF NOT EXISTS idx_credential_revocations_expire ON credential_revocations(expire_at)')
    sqliteDb = db
    importLegacyJsonInto(db)
    loadSqliteIntoMemory(db)
    return db
  } catch (error) {
    console.error('[sessionRevocation] SQLite 初始化失败，将回退:', error)
    if (db) {
      try {
        db.close()
      } catch {
        // ignore
      }
    }
    sqliteDb = null
    return null
  }
}

/** 首次启用 SQLite 时，将旧 JSON 撤销记录一次性导入并归档。 */
function importLegacyJsonInto(db: SqliteDatabase): void {
  if (!LEGACY_FILE || LEGACY_FILE === DB_FILE || !fs.existsSync(LEGACY_FILE)) return
  try {
    const countRow = db
      .prepare(
        'SELECT (SELECT COUNT(*) FROM revocations) + (SELECT COUNT(*) FROM credential_revocations) AS count',
      )
      .get() as { count?: number } | undefined
    if ((countRow?.count ?? 0) > 0) return

    const persisted = readPersistedJson(LEGACY_FILE)
    if (!persisted || (persisted.sessions.size === 0 && persisted.credentials.size === 0)) return

    db.exec('BEGIN')
    try {
      const insertSession = db.prepare('INSERT OR IGNORE INTO revocations (key, expire_at) VALUES (?, ?)')
      for (const [sessionKey, expireAt] of persisted.sessions) {
        insertSession.run(sessionKey, expireAt)
      }
      const insertCredential = db.prepare(
        'INSERT OR IGNORE INTO credential_revocations (credential_id, invalid_before, expire_at) VALUES (?, ?, ?)',
      )
      for (const [credentialKey, record] of persisted.credentials) {
        insertCredential.run(credentialKey, record.invalidBefore, record.expireAt)
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }

    fs.renameSync(LEGACY_FILE, `${LEGACY_FILE}.imported-${Date.now()}`)
    console.info(
      `[sessionRevocation] 已从 JSON 导入 ${persisted.sessions.size} 条会话撤销、${persisted.credentials.size} 条凭证水位线到 SQLite`,
    )
  } catch (error) {
    console.error('[sessionRevocation] 旧 JSON 导入 SQLite 失败（忽略，继续使用 SQLite）:', error)
  }
}

function loadSqliteIntoMemory(db: SqliteDatabase): void {
  try {
    const now = Date.now()
    db.prepare('DELETE FROM revocations WHERE expire_at <= ?').run(now)
    db.prepare('DELETE FROM credential_revocations WHERE expire_at <= ?').run(now)

    const sessionRows = db.prepare('SELECT key, expire_at FROM revocations').all() as Array<{
      key?: unknown
      expire_at?: unknown
    }>
    for (const row of sessionRows) {
      if (typeof row.key === 'string' && typeof row.expire_at === 'number' && row.expire_at > now) {
        sessionStore.set(row.key, row.expire_at)
      }
    }

    const credentialRows = db
      .prepare('SELECT credential_id, invalid_before, expire_at FROM credential_revocations')
      .all() as Array<{ credential_id?: unknown; invalid_before?: unknown; expire_at?: unknown }>
    for (const row of credentialRows) {
      if (
        typeof row.credential_id === 'string' &&
        typeof row.invalid_before === 'number' &&
        typeof row.expire_at === 'number' &&
        row.expire_at > now
      ) {
        credentialStore.set(row.credential_id, { invalidBefore: row.invalid_before, expireAt: row.expire_at })
      }
    }
  } catch (error) {
    console.error('[sessionRevocation] 读取 SQLite 撤销记录失败:', error)
  }
}

function persistSqlite(sessionKey: string, expireAt: number): void {
  const db = ensureSqlite()
  if (!db) return
  try {
    db.prepare(
      'INSERT INTO revocations (key, expire_at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET expire_at = excluded.expire_at',
    ).run(sessionKey, expireAt)
    db.prepare('DELETE FROM revocations WHERE expire_at <= ?').run(Date.now())
  } catch (error) {
    console.error('[sessionRevocation] 写入 SQLite 会话撤销失败:', error)
  }
}

function persistSqliteCredential(credentialKey: string, invalidBefore: number, expireAt: number): void {
  const db = ensureSqlite()
  if (!db) return
  try {
    db.prepare(
      'INSERT INTO credential_revocations (credential_id, invalid_before, expire_at) VALUES (?, ?, ?) ON CONFLICT(credential_id) DO UPDATE SET invalid_before = excluded.invalid_before, expire_at = excluded.expire_at',
    ).run(credentialKey, invalidBefore, expireAt)
    db.prepare('DELETE FROM credential_revocations WHERE expire_at <= ?').run(Date.now())
  } catch (error) {
    console.error('[sessionRevocation] 写入 SQLite 凭证水位线失败:', error)
  }
}

// ── 惰性加载 ──

function ensureLoaded(): void {
  if (loaded) return
  loaded = true
  backendKind = resolveBackendKind()

  if (backendKind === 'sqlite' && !ensureSqlite()) {
    // SQLite 打开失败：降级到 JSON（若配置）或纯内存
    backendKind = LEGACY_FILE ? 'json' : 'memory'
  }

  if (backendKind === 'json') {
    loadJsonFromDisk()
  }
}

function persistSessionRevocation(sessionKey: string, expireAt: number): void {
  if (backendKind === 'sqlite') {
    persistSqlite(sessionKey, expireAt)
  } else if (backendKind === 'json') {
    schedulePersistJson()
  }
}

function persistCredentialRevocation(credentialKey: string, invalidBefore: number, expireAt: number): void {
  if (backendKind === 'sqlite') {
    persistSqliteCredential(credentialKey, invalidBefore, expireAt)
  } else if (backendKind === 'json') {
    schedulePersistJson()
  }
}

// 进程退出兜底：未及防抖完成的写在此同步刷盘（PM2 reload 场景）或关闭连接
const IS_BUILD_PHASE = process.env.NEXT_PHASE === 'phase-production-build'
if ((LEGACY_FILE || DB_FILE) && !IS_BUILD_PHASE) {
  process.on('exit', () => {
    if (writeTimer) {
      clearTimeout(writeTimer)
      writeTimer = null
    }
    if (backendKind === 'json' && LEGACY_FILE) {
      try {
        fs.mkdirSync(path.dirname(LEGACY_FILE), { recursive: true })
        const tmp = `${LEGACY_FILE}.tmp`
        fs.writeFileSync(tmp, serializeStores(), 'utf8')
        fs.renameSync(tmp, LEGACY_FILE)
      } catch {
        // 退出兜底失败不影响进程退出
      }
    }
    if (sqliteDb) {
      try {
        sqliteDb.close()
      } catch {
        // ignore
      }
    }
  })
}

// ── 公开 API ──

/** 单会话撤销：key 形如 sid:<id> / legacy:<hash>。 */
export function revokeAuthSession(sessionKey: string, ttlMs: number): void {
  const normalizedKey = sessionKey.trim()
  if (!normalizedKey || ttlMs <= 0) return

  ensureLoaded()
  const now = Date.now()
  cleanupExpired(now)
  const expireAt = now + ttlMs
  sessionStore.set(normalizedKey, expireAt)
  persistSessionRevocation(normalizedKey, expireAt)
}

export function isAuthSessionRevoked(sessionKey: string): boolean {
  const normalizedKey = sessionKey.trim()
  if (!normalizedKey) return false

  ensureLoaded()
  const now = Date.now()
  cleanupExpired(now)

  const expireAt = sessionStore.get(normalizedKey)
  if (!expireAt) return false

  if (expireAt <= now) {
    sessionStore.delete(normalizedKey)
    return false
  }

  return true
}

/**
 * 凭证级水位线（「注销全部」）：无效化所有 issuedAt < invalidBefore 的会话，直到 expireAt。
 * key 建议由调用方用凭证指纹生成（如 cred:<fingerprint>）。
 * 水位线只前进：重复写入取更大的 invalidBefore / expireAt，避免旧请求回退。
 */
export function revokeCredential(credentialKey: string, invalidBefore: number, ttlMs: number): void {
  const normalizedKey = credentialKey.trim()
  if (!normalizedKey || !Number.isFinite(invalidBefore) || ttlMs <= 0) return

  ensureLoaded()
  const now = Date.now()
  cleanupExpired(now)

  const existing = credentialStore.get(normalizedKey)
  const nextInvalidBefore = existing ? Math.max(existing.invalidBefore, invalidBefore) : invalidBefore
  const nextExpireAt = Math.max(now + ttlMs, existing?.expireAt ?? 0)

  credentialStore.set(normalizedKey, { invalidBefore: nextInvalidBefore, expireAt: nextExpireAt })
  persistCredentialRevocation(normalizedKey, nextInvalidBefore, nextExpireAt)
}

/** 判断某个凭证下、签发时间为 issuedAt 的会话是否已被水位线无效化。 */
export function isCredentialRevoked(credentialKey: string, issuedAt: number): boolean {
  const normalizedKey = credentialKey.trim()
  if (!normalizedKey || !Number.isFinite(issuedAt)) return false

  ensureLoaded()
  const now = Date.now()
  cleanupExpired(now)

  const record = credentialStore.get(normalizedKey)
  if (!record) return false

  if (record.expireAt <= now) {
    credentialStore.delete(normalizedKey)
    return false
  }

  return issuedAt < record.invalidBefore
}

/**
 * 仅用于单元测试：重置内存中的撤销记录与后端状态。
 * 同时取消未落盘的防抖写、关闭 SQLite 连接，避免测试间相互污染。
 */
export function resetAuthSessionRevocationsForTest(): void {
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = null
  }
  writeChain = Promise.resolve()
  sessionStore.clear()
  credentialStore.clear()
  loaded = false
  backendKind = null
  if (sqliteDb) {
    try {
      sqliteDb.close()
    } catch {
      // ignore
    }
    sqliteDb = null
  }
}
