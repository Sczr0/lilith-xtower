import { describe, it, expect } from 'vitest';
import { parseTipsText, __buildCandidatesForTest } from '../TipsProvider';

describe('parseTipsText', () => {
  it('trims, filters blanks and comments, and de-duplicates', () => {
    const text = `\n# comment\n  hello  \n\nworld\nhello\n# end\n`;
    const arr = parseTipsText(text);
    expect(arr).toEqual(['hello', 'world']);
  });
});

describe('__buildCandidatesForTest', () => {
  it('includes prefixed and root candidates in order', () => {
    const c = __buildCandidatesForTest('/base');
    expect(c).toEqual([
      '/base/tips.txt', '/tips.txt',
      '/base/Tip.txt', '/Tip.txt',
      '/base/Tips.txt', '/Tips.txt',
      '/base/tip.txt', '/tip.txt',
    ]);
  });
  it('falls back to root-only when prefix empty', () => {
    const c = __buildCandidatesForTest('');
    expect(c).toEqual([
      '/tips.txt',
      '/Tip.txt',
      '/Tips.txt',
      '/tip.txt',
    ]);
  });
});

