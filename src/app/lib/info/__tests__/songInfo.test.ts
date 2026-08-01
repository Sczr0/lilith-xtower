import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  computeTheoryRks,
  displayLevelForFilter,
  getSongLevel,
  matchLevelRange,
  mergeSongInfo,
  parseCsv,
  parseDifficultyCsv,
  parseLevelCell,
  parseSongInfoCsv,
  parseVersionLine,
  type SongInfo,
} from '../csv';

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf8');

const songCsv = fixture('info.csv');
const difficultyCsv = fixture('difficulty.csv');
const versionText = fixture('version.txt');

describe('parseCsv', () => {
  it('解析带表头的基础 CSV', () => {
    const rows = parseCsv('a,b,c\n1,2,3\n');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('支持引号包裹字段与 "" 转义', () => {
    const rows = parseCsv('a,"b, c",d\n"he said ""hi""",2,3\n');
    expect(rows).toEqual([
      ['a', 'b, c', 'd'],
      ['he said "hi"', '2', '3'],
    ]);
  });

  it('支持字段内换行与 CRLF', () => {
    const rows = parseCsv('"line1\nline2",x\r\n"a\r\nb",y\r\n');
    expect(rows).toEqual([
      ['line1\nline2', 'x'],
      ['a\r\nb', 'y'],
    ]);
  });

  it('支持无换行结尾的最后一行与空字段', () => {
    const rows = parseCsv('a,,c\n1,2,');
    expect(rows).toEqual([
      ['a', '', 'c'],
      ['1', '2', ''],
    ]);
  });
});

describe('parseLevelCell', () => {
  it('空字符串 → null', () => {
    expect(parseLevelCell('')).toBeNull();
    expect(parseLevelCell('  ')).toBeNull();
  });

  it('数字字符串 → number', () => {
    expect(parseLevelCell('13.6')).toBe(13.6);
    expect(parseLevelCell(' 8.6 ')).toBe(8.6);
  });

  it('非法值 → null', () => {
    expect(parseLevelCell('abc')).toBeNull();
  });
});

describe('parseSongInfoCsv / parseDifficultyCsv / mergeSongInfo', () => {
  it('真实上游 info.csv 解析出曲目且字段完整（EZ/HD/IN/AT 列为谱师）', () => {
    const songs = parseSongInfoCsv(songCsv);
    expect(songs.length).toBeGreaterThan(250);

    const first = songs[0];
    expect(first.id).toBe('Glaciaxion.SunsetRay');
    expect(first.name).toBe('Glaciaxion');
    expect(first.composer).toBe('SunsetRay');
    expect(first.illustrator).toBe('艾若拉');
    // info.csv 的难度列是谱师名，不是定数
    expect(first.ez).toBeNull();
    expect(first.chartEz).toBe('Barbarianerman');
    expect(first.chartIn).toBe('Barbarianerman vs. NerSAN');
  });

  it('真实上游引号转义字段被正确还原（谱师名含引号）', () => {
    const songs = parseSongInfoCsv(songCsv);
    const six = songs.find((s) => s.id === '望影の方舟Six.SeURa');
    expect(six).toBeDefined();
    expect(six?.illustrator).toBe('鲸弑');
    expect(six?.chartIn).toBe('六回目Traveler Scend as "Knight of Arq"');
  });

  it('真实上游 difficulty.csv 有 46 首 AT 定数曲目', () => {
    const map = parseDifficultyCsv(difficultyCsv);
    const withAt = Object.values(map).filter((v) => v.AT != null);
    expect(withAt.length).toBe(46);
  });

  it('mergeSongInfo 以 info.csv 为全集并用 difficulty.csv 覆盖定数', () => {
    const data = mergeSongInfo(songCsv, difficultyCsv, versionText);
    expect(data.songs.length).toBe(parseSongInfoCsv(songCsv).length);

    const derRichter = data.songs.find((s) => s.id === 'DerRichter.Ωμεγα');
    expect(derRichter?.at).toBe(16.9);

    // difficulty.csv 中无 AT 列的歌曲，AT 应为 null
    const glaciaxion = data.songs.find((s) => s.id === 'Glaciaxion.SunsetRay');
    expect(glaciaxion?.at).toBeNull();

    // 所有曲目至少有一个非空定数
    for (const song of data.songs) {
      const hasLevel = song.ez !== null || song.hd !== null || song.in !== null || song.at !== null;
      expect(hasLevel).toBe(true);
    }
  });

  it('getSongLevel 按难度取定数（合并后）', () => {
    const data = mergeSongInfo(songCsv, difficultyCsv, versionText);
    const first = data.songs[0];
    expect(getSongLevel(first, 'EZ')).toBe(1.0);
    expect(getSongLevel(first, 'AT')).toBeNull();
  });
});

describe('computeTheoryRks', () => {
  it('按用户公式：前 27 定数，前三 ×2，求和 ÷30', () => {
    // 构造 30 首全 15.0 定数：前 3 ×2，第 4-27 ×1，第 28-30 不计
    const songs: SongInfo[] = Array.from({ length: 30 }, (_, i) => ({
      id: `s${i}`,
      name: `S${i}`,
      composer: 'A',
      illustrator: 'B',
      ez: null,
      hd: null,
      in: 15.0,
      at: null,
      chartEz: null,
      chartHd: null,
      chartIn: 'X',
      chartAt: null,
    }));
    const expected = (15 * 2 * 3 + 15 * 24) / 30; // 前3翻倍 + 第4~27
    expect(computeTheoryRks(songs)).toBeCloseTo(expected, 10);
  });

  it('不足 27 首时按实际数量计算', () => {
    const songs: SongInfo[] = Array.from({ length: 5 }, (_, i) => ({
      id: `s${i}`,
      name: `S${i}`,
      composer: 'A',
      illustrator: 'B',
      ez: 10.0,
      hd: null,
      in: null,
      at: null,
      chartEz: 'X',
      chartHd: null,
      chartIn: null,
      chartAt: null,
    }));
    // 5 首 10.0：前 3 ×2 + 后 2 ×1 = 80，÷30
    expect(computeTheoryRks(songs)).toBeCloseTo(80 / 30, 10);
  });

  it('无定数数据返回 null', () => {
    expect(computeTheoryRks([])).toBeNull();
  });

  it('真实数据计算出的理论 RKS 在合理区间（12~18）', () => {
    const data = mergeSongInfo(songCsv, difficultyCsv, versionText);
    const rks = computeTheoryRks(data.songs);
    expect(rks).not.toBeNull();
    expect(rks as number).toBeGreaterThan(12);
    expect(rks as number).toBeLessThan(18);
  });
});

describe('displayLevelForFilter / matchLevelRange', () => {
  const sample: SongInfo = {
    id: 'Test.Sample',
    name: 'Test',
    composer: 'A',
    illustrator: 'B',
    ez: 2.0,
    hd: 8.5,
    in: 13.6,
    at: null,
    chartEz: 'X',
    chartHd: null,
    chartIn: 'Y',
    chartAt: null,
  };

  it('displayLevelForFilter：ALL 取最高定数，单难度取对应值', () => {
    expect(displayLevelForFilter(sample, 'ALL')).toBe(13.6);
    expect(displayLevelForFilter(sample, 'EZ')).toBe(2.0);
    expect(displayLevelForFilter(sample, 'AT')).toBeNull();
  });

  it('displayLevelForFilter：全部难度为空时返回 null', () => {
    const empty: SongInfo = { ...sample, ez: null, hd: null, in: null };
    expect(displayLevelForFilter(empty, 'ALL')).toBeNull();
  });

  it('matchLevelRange：ALL 模式任一难度落在区间内即通过', () => {
    expect(matchLevelRange(sample, 'ALL', 13, null)).toBe(true); // IN 13.6
    expect(matchLevelRange(sample, 'ALL', null, 3)).toBe(true); // EZ 2.0
    expect(matchLevelRange(sample, 'ALL', 9, 12)).toBe(false); // 无难度在 [9,12]
  });

  it('matchLevelRange：单难度模式只匹配该难度', () => {
    expect(matchLevelRange(sample, 'IN', 13, null)).toBe(true);
    expect(matchLevelRange(sample, 'IN', null, 12)).toBe(false);
    expect(matchLevelRange(sample, 'AT', 10, 20)).toBe(false); // AT 为 null
  });

  it('matchLevelRange：无限制时恒通过', () => {
    expect(matchLevelRange(sample, 'ALL', null, null)).toBe(true);
  });
});

describe('parseVersionLine', () => {
  it('解析 "3.19.5 (153)"', () => {
    expect(parseVersionLine('3.19.5 (153)')).toEqual({ version: '3.19.5', build: 153 });
  });

  it('解析 "3.19.5 (153)\\n"（带换行）', () => {
    expect(parseVersionLine(versionText)).toEqual({ version: '3.19.5', build: 153 });
  });

  it('无构建号时不崩溃', () => {
    expect(parseVersionLine('3.20.0')).toEqual({ version: '3.20.0', build: null });
    expect(parseVersionLine('')).toEqual({ version: '', build: null });
  });
});
