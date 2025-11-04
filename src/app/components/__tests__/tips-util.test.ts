import { describe, it, expect } from 'vitest';
import { parseTipsText } from '../TipsProvider';

describe('parseTipsText', () => {
  it('trims, filters blanks and comments, and de-duplicates', () => {
    const text = `\n# comment\n  hello  \n\nworld\nhello\n# end\n`;
    const arr = parseTipsText(text);
    expect(arr).toEqual(['hello', 'world']);
  });
});

// embedded mode no longer builds network candidates; tests removed
