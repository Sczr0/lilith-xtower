import { describe, expect, it } from 'vitest';
import { coerceFiniteNumber, formatFixedNumber, formatLocaleNumber, parseFiniteNumber } from '../number';

describe('number utils', () => {
  describe('parseFiniteNumber', () => {
    it('returns the same number for finite numbers', () => {
      expect(parseFiniteNumber(0)).toBe(0);
      expect(parseFiniteNumber(12.34)).toBe(12.34);
    });

    it('returns null for NaN/Infinity', () => {
      expect(parseFiniteNumber(Number.NaN)).toBeNull();
      expect(parseFiniteNumber(Number.POSITIVE_INFINITY)).toBeNull();
      expect(parseFiniteNumber(Number.NEGATIVE_INFINITY)).toBeNull();
    });

    it('parses numeric strings', () => {
      expect(parseFiniteNumber('  42  ')).toBe(42);
      expect(parseFiniteNumber('3.14')).toBeCloseTo(3.14);
    });

    it('returns null for empty or non-numeric strings', () => {
      expect(parseFiniteNumber('')).toBeNull();
      expect(parseFiniteNumber('   ')).toBeNull();
      expect(parseFiniteNumber('nope')).toBeNull();
    });

    it('returns null for non-number non-string values', () => {
      expect(parseFiniteNumber(null)).toBeNull();
      expect(parseFiniteNumber(undefined)).toBeNull();
      expect(parseFiniteNumber({})).toBeNull();
      expect(parseFiniteNumber([])).toBeNull();
    });
  });

  describe('coerceFiniteNumber', () => {
    it('returns fallback when value is not finite', () => {
      expect(coerceFiniteNumber(undefined, 7)).toBe(7);
      expect(coerceFiniteNumber('nope', 7)).toBe(7);
      expect(coerceFiniteNumber(Number.NaN, 7)).toBe(7);
    });

    it('parses numeric strings', () => {
      expect(coerceFiniteNumber('  8  ', 0)).toBe(8);
    });
  });

  describe('formatFixedNumber', () => {
    it('formats finite numbers', () => {
      expect(formatFixedNumber(1.2345, 2)).toBe('1.23');
      expect(formatFixedNumber('1.2345', 3)).toBe('1.234');
    });

    it('clamps invalid digits', () => {
      expect(formatFixedNumber(1.2, -5)).toBe('1');
      expect(formatFixedNumber(1.2, Number.NaN)).toBe('1');
    });

    it('returns fallback for invalid input', () => {
      expect(formatFixedNumber(undefined, 2)).toBe('--');
      expect(formatFixedNumber('nope', 2, 'N/A')).toBe('N/A');
    });
  });

  describe('formatLocaleNumber', () => {
    it('formats with locale grouping', () => {
      expect(formatLocaleNumber(10000, 'zh-CN')).toBe('10,000');
    });

    it('returns fallback for invalid input', () => {
      expect(formatLocaleNumber(undefined, 'zh-CN', {}, 'N/A')).toBe('N/A');
    });
  });
});

