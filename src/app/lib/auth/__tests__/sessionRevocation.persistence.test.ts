/**
 * sessionRevocation 文件持久化集成测试
 *
 * 覆盖：写盘、模拟 PM2 重启后撤销仍有效、过期记录不落盘、损坏文件隔离。
 * 通过 AUTH_SESSION_REVOCATION_FILE 指向临时文件，验证生产路径行为。
 */
import { describe, it, expect, afterAll, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

import type * as RevocationModule from '../sessionRevocation'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'revocation-persist-'))
const revFile = path.join(tmpDir, 'revocations.json')

async function loadModule(): Promise<typeof RevocationModule> {
  vi.resetModules()
  vi.stubEnv('AUTH_SESSION_REVOCATION_FILE', revFile)
  return import('../sessionRevocation')
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

afterAll(() => {
  vi.unstubAllEnvs()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('sessionRevocation 文件持久化', () => {
  it('revoke 后经防抖写入磁盘文件', async () => {
    const mod = await loadModule()
    mod.revokeAuthSession('sid:persist-1', 60_000)
    await wait(700) // 防抖 500ms + 写盘余量

    const raw = JSON.parse(fs.readFileSync(revFile, 'utf8')) as Record<string, number>
    expect(typeof raw['sid:persist-1']).toBe('number')
    expect(raw['sid:persist-1']!).toBeGreaterThan(Date.now())
  })

  it('模拟进程重启（重新加载模块）后撤销记录仍有效', async () => {
    const mod = await loadModule()
    mod.revokeAuthSession('sid:restart-1', 60_000)
    await wait(700)

    // 模拟 PM2 reload：清模块缓存重新加载（新内存表 + 从磁盘恢复）
    const reloaded = await loadModule()
    expect(reloaded.isAuthSessionRevoked('sid:restart-1')).toBe(true)
  })

  it('过期记录不写入磁盘', async () => {
    const mod = await loadModule()
    mod.revokeAuthSession('sid:expired-1', 1) // 1ms 后即过期
    await wait(700)

    const raw = JSON.parse(fs.readFileSync(revFile, 'utf8')) as Record<string, number>
    expect(raw['sid:expired-1']).toBeUndefined()
  })

  it('磁盘文件损坏时隔离并继续工作', async () => {
    fs.writeFileSync(revFile, '{this is not valid json', 'utf8')

    const mod = await loadModule()
    expect(() => mod.revokeAuthSession('sid:corrupt-1', 60_000)).not.toThrow()
    expect(mod.isAuthSessionRevoked('sid:corrupt-1')).toBe(true)

    const corruptFiles = fs.readdirSync(tmpDir).filter((f) => f.startsWith('revocations.json.corrupt-'))
    expect(corruptFiles.length).toBe(1)
  })
})
