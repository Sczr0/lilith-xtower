/**
 * 将敏感字符串做“可读但不可复原”的遮罩展示。
 * 说明：用于 UI/日志/调试信息的脱敏输出，避免直接暴露凭证/密钥。
 */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return ''

  // 太短的字符串直接全遮罩，避免“短 token”被轻易猜出
  if (value.length <= 12) return '****'

  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

