import { maskSecret } from './maskSecret'

export type StringifyJsonForDisplayOptions = {
  redacted?: boolean
}

const SENSITIVE_KEY_RE = /token|secret|password|session|cookie|authorization/i

function shouldRedactKey(key: string): boolean {
  if (!key) return false
  return SENSITIVE_KEY_RE.test(key)
}

/**
 * 将 JSON 安全地 stringify 为可展示文本，并在需要时对敏感字段做脱敏。
 *
 * 说明：
 * - 仅用于 UI 展示/调试信息，避免直接暴露 token 等敏感字段。
 * - 支持循环引用（会输出 "[Circular]"），避免 stringify 直接抛错导致页面崩溃。
 */
export function stringifyJsonForDisplay(value: unknown, options?: StringifyJsonForDisplayOptions): string {
  const redacted = options?.redacted !== false
  const seen = new WeakSet<object>()

  return JSON.stringify(
    value,
    (key, current) => {
      if (current && typeof current === 'object') {
        if (seen.has(current as object)) return '[Circular]'
        seen.add(current as object)
      }

      if (!redacted) return current

      if (typeof current === 'string' && shouldRedactKey(key)) {
        return maskSecret(current)
      }

      return current
    },
    2,
  )
}

