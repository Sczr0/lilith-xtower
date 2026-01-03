/**
 * 日期工具（尽量不引入额外依赖）
 * - 主要用于 stats 的 YYYY-MM-DD 查询参数生成（按 IANA timezone 口径）
 */

export function normalizeIanaTimeZone(timeZone?: string | null): string {
  const candidate = typeof timeZone === 'string' && timeZone.trim().length > 0 ? timeZone.trim() : 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate });
    return candidate;
  } catch {
    return 'UTC';
  }
}

export function formatYmdInTimeZone(date: Date, timeZone: string): string {
  const safeTz = normalizeIanaTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    // 极端情况下 Intl 无法返回预期 parts，回退到 UTC 口径
    const utcParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const y = utcParts.find((p) => p.type === 'year')?.value ?? '1970';
    const m = utcParts.find((p) => p.type === 'month')?.value ?? '01';
    const d = utcParts.find((p) => p.type === 'day')?.value ?? '01';
    return `${y}-${m}-${d}`;
  }

  return `${year}-${month}-${day}`;
}

export function getRecentYmdRange(timeZone: string, days: number, now: Date = new Date()): { start: string; end: string } {
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.floor(days)) : 1;
  const end = formatYmdInTimeZone(now, timeZone);
  const startDate = new Date(now.getTime() - (safeDays - 1) * 24 * 60 * 60 * 1000);
  const start = formatYmdInTimeZone(startDate, timeZone);
  return { start, end };
}

