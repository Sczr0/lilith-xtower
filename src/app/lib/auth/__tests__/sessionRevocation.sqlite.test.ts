/**
 * sessionRevocation SQLite 后端集成测试
 *
 * 覆盖：SQLite 立即持久化、模拟 PM2 重启后仍有效、旧 JSON 一次性导入并归档。
 * 仅在运行环境支持 node:sqlite 时执行（Node >= 22.5，Node 22 可能需 --experimental-sqlite）。
 */
import { afterAll, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

import type * as RevocationModule from '../sessionRevocation'

const hasSqlite = (() => {
  try {
    const getBuiltinModule = (process as unknown as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule
    if (typeof getBuiltinModule !== 'function') return false
    return Boolean(getBuiltinModule('node:sqlite'))
  } catch {
    return false
  }
})()

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'revocation-sqlite-'))

type Paths = { dir: string; dbFile: string; legacyFile: string }

function freshPaths(name: string): Paths {
  const dir = path.join(tmpDir, name)
  fs.mkdirSync(dir, { recursive: true })
  return { dir, dbFile: path.join(dir, 'revocations.db'), legacyFile: path.join(dir, 'revocations.json') }
}

async function loadModule(paths: Paths): Promise<typeof RevocationModule> {
  vi.resetModules()
  vi.stubEnv('AUTH_SESSION_REVOCATION_DB', paths.dbFile)
  vi.stubEnv('AUTH_SESSION_REVOCATION_FILE', paths.legacyFile)
  vi.stubEnv('AUTH_SESSION_REVOCATION_BACKEND', 'sqlite')
  return import('../sessionRevocation')
}

afterAll(() => {
  vi.unstubAllEnvs()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe.runIf(hasSqlite)('sessionRevocation SQLite 持久化', () => {
  it('revoke 后立即写入 SQLite，重载模块后仍有效', async () => {
    const paths = freshPaths('persist')
    const mod = await loadModule(paths)
    mod.revokeAuthSession('sid:sqlite-1', 60_000)

    const reloaded = await loadModule(paths)
    expect(reloaded.isAuthSessionRevoked('sid:sqlite-1')).toBe(true)

    mod.resetAuthSessionRevocationsForTest()
    reloaded.resetAuthSessionRevocationsForTest()
  })

  it('过期记录不再生效', async () => {
    const paths = freshPaths('expired')
    const mod = await loadModule(paths)
    mod.revokeAuthSession('sid:sqlite-expired', 1)
    await new Promise((resolve) => setTimeout(resolve, 20))

    const reloaded = await loadModule(paths)
    expect(reloaded.isAuthSessionRevoked('sid:sqlite-expired')).toBe(false)

    mod.resetAuthSessionRevocationsForTest()
    reloaded.resetAuthSessionRevocationsForTest()
  })

  it('凭证水位线持久化到 SQLite，重载后仍有效', async () => {
    const paths = freshPaths('credential')
    const mod = await loadModule(paths)
    const watermark = Date.now()
    mod.revokeCredential('cred:user-1', watermark, 60_000)

    const reloaded = await loadModule(paths)
    expect(reloaded.isCredentialRevoked('cred:user-1', watermark - 1)).toBe(true)
    expect(reloaded.isCredentialRevoked('cred:user-1', watermark + 1)).toBe(false)

    mod.resetAuthSessionRevocationsForTest()
    reloaded.resetAuthSessionRevocationsForTest()
  })

  it('首次启用时从旧 JSON 导入并归档', async () => {
    const paths = freshPaths('import')
    fs.writeFileSync(paths.legacyFile, JSON.stringify({ 'sid:legacy-1': Date.now() + 60_000 }), 'utf8')

    const mod = await loadModule(paths)
    expect(mod.isAuthSessionRevoked('sid:legacy-1')).toBe(true)

    const imported = fs.readdirSync(paths.dir).filter((f) => f.startsWith('revocations.json.imported-'))
    expect(imported.length).toBe(1)

    mod.resetAuthSessionRevocationsForTest()
  })

  it('首次启用时导入旧 JSON 中的凭证水位线', async () => {
    const paths = freshPaths('import-credential')
    const watermark = Date.now() - 1_000
    fs.writeFileSync(
      paths.legacyFile,
      JSON.stringify({
        __credentials__: { 'cred:legacy-1': { invalidBefore: watermark, expireAt: Date.now() + 60_000 } },
      }),
      'utf8',
    )

    const mod = await loadModule(paths)
    expect(mod.isCredentialRevoked('cred:legacy-1', watermark - 1)).toBe(true)
    expect(mod.isCredentialRevoked('cred:legacy-1', watermark + 1)).toBe(false)

    mod.resetAuthSessionRevocationsForTest()
  })
})
