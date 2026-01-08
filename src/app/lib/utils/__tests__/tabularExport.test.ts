import { describe, expect, it } from 'vitest';
import { exportTabularDataToCsv, exportTabularDataToTsv } from '../tabularExport';

describe('tabularExport', () => {
  it('exports csv with quoting/escaping', () => {
    const csv = exportTabularDataToCsv({
      headers: ['a', 'b'],
      rows: [
        ['plain', 'x'],
        ['has,comma', 'y'],
        ['has"quote', 'z'],
        ['has\nnewline', 'w'],
      ],
    });

    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('a,b');
    expect(lines[1]).toBe('plain,x');
    expect(lines[2]).toBe('"has,comma",y');
    expect(lines[3]).toBe('"has\"\"quote",z');
    expect(lines[4]).toBe('"has\nnewline",w');
  });

  it('can add BOM for csv', () => {
    const csv = exportTabularDataToCsv({ headers: ['a'], rows: [['b']] }, { bom: true });
    expect(csv.startsWith('\ufeffa')).toBe(true);
  });

  it('exports tsv and sanitizes tabs/newlines', () => {
    const tsv = exportTabularDataToTsv({
      headers: ['a', 'b'],
      rows: [['x\ty', 'line1\nline2']],
    });
    expect(tsv).toBe(['a\tb', 'x y\tline1 line2'].join('\r\n'));
  });
});

