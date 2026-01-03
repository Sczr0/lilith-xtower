import { describe, expect, it } from 'vitest';
import { formatYmdInTimeZone, getRecentYmdRange, normalizeIanaTimeZone } from '../date';

describe('lib/utils/date', () => {
  it('normalizeIanaTimeZone: invalid -> UTC', () => {
    expect(normalizeIanaTimeZone('Invalid/Timezone')).toBe('UTC');
    expect(normalizeIanaTimeZone('')).toBe('UTC');
    expect(normalizeIanaTimeZone(null)).toBe('UTC');
  });

  it('formatYmdInTimeZone: formats YYYY-MM-DD in given timezone', () => {
    const dt = new Date('2025-01-01T16:00:00Z'); // Asia/Shanghai = 2025-01-02 00:00
    expect(formatYmdInTimeZone(dt, 'UTC')).toBe('2025-01-01');
    expect(formatYmdInTimeZone(dt, 'Asia/Shanghai')).toBe('2025-01-02');
  });

  it('getRecentYmdRange: returns inclusive start/end', () => {
    const now = new Date('2025-01-10T12:34:56Z');
    expect(getRecentYmdRange('UTC', 1, now)).toEqual({ start: '2025-01-10', end: '2025-01-10' });
    expect(getRecentYmdRange('UTC', 3, now)).toEqual({ start: '2025-01-08', end: '2025-01-10' });
  });
});

