/**
 * 数值工具：用于处理来自 API / localStorage 等不可信来源的数据。
 *
 * 目标：
 * - 避免在渲染阶段直接调用 undefined.toFixed / undefined.toLocaleString 导致页面崩溃
 * - 提供最小且通用的归一化与格式化能力，便于组件复用
 */

/**
 * 将 unknown 解析为有限数值。
 * - number：要求 Number.isFinite
 * - string：trim 后用 Number() 解析，并要求 Number.isFinite
 */
export function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

/**
 * 将 unknown 解析为有限数值，否则返回 fallback。
 */
export function coerceFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = parseFiniteNumber(value);
  return parsed === null ? fallback : parsed;
}

/**
 * 安全的 toFixed：当 value 不可用时返回 fallback，而不是抛异常。
 */
export function formatFixedNumber(value: unknown, digits: number, fallback = '--'): string {
  const safeDigits = Number.isFinite(digits) ? Math.max(0, Math.floor(digits)) : 0;
  const parsed = parseFiniteNumber(value);
  if (parsed === null) return fallback;
  try {
    return parsed.toFixed(safeDigits);
  } catch {
    return fallback;
  }
}

/**
 * 安全的本地化格式化：当 value 不可用时返回 fallback，而不是抛异常。
 */
export function formatLocaleNumber(
  value: unknown,
  locale: string = 'zh-CN',
  options: Intl.NumberFormatOptions = {},
  fallback = '--',
): string {
  const parsed = parseFiniteNumber(value);
  if (parsed === null) return fallback;
  try {
    return parsed.toLocaleString(locale, options);
  } catch {
    return fallback;
  }
}

