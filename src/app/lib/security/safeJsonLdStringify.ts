/**
 * 说明：输出到 `<script type="application/ld+json">` 时，为避免 `</script>` 提前闭合导致边界问题，
 * 统一将 `<` 转义为 `\\u003c`（等价 JSON 字符串表示）。
 */
export function safeJsonLdStringify(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

