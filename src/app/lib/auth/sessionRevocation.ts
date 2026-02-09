type SessionRevocationStore = Map<string, number>

const revocationStore: SessionRevocationStore = new Map()

function cleanupExpired(now: number): void {
  for (const [sessionKey, expireAt] of revocationStore.entries()) {
    if (expireAt <= now) {
      revocationStore.delete(sessionKey)
    }
  }
}

export function revokeAuthSession(sessionKey: string, ttlMs: number): void {
  const normalizedKey = sessionKey.trim()
  if (!normalizedKey || ttlMs <= 0) return

  const now = Date.now()
  cleanupExpired(now)
  revocationStore.set(normalizedKey, now + ttlMs)
}

export function isAuthSessionRevoked(sessionKey: string): boolean {
  const normalizedKey = sessionKey.trim()
  if (!normalizedKey) return false

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
 */
export function resetAuthSessionRevocationsForTest(): void {
  revocationStore.clear()
}

