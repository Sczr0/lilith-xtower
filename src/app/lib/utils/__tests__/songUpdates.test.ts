import { describe, expect, it } from 'vitest';

import { countNewSongs, countUpdateNoteChanges } from '../songUpdates';

describe('songUpdates utils', () => {
  describe('countNewSongs', () => {
    it('counts ### songs within the “新增曲目” section', () => {
      const md = [
        '# Phigros 3.18.1 新曲速递',
        '',
        '## 新增曲目',
        '',
        '### 最高傑作',
        '',
        '- **艺术家**: PYKAMIA',
        '',
        '### Locomotive',
        '',
        '- **艺术家**: ♠K',
        '',
        '---',
        '',
        '**更新说明**: 此次更新同时修改了A IN，B AT谱面',
      ].join('\n');

      expect(countNewSongs(md)).toBe(2);
    });

    it('does not stop at the first ### heading (section ends at same/higher level heading)', () => {
      const md = [
        '# Title',
        '',
        '## 新增曲目',
        '',
        '### A',
        '- x',
        '',
        '### B',
        '- y',
        '',
        '## 其他',
        '',
        '### Not a song',
      ].join('\n');

      expect(countNewSongs(md)).toBe(2);
    });

    it('returns 0 when the section is missing', () => {
      expect(countNewSongs('# Title\n\n### A')).toBe(0);
    });
  });

  describe('countUpdateNoteChanges', () => {
    it('counts 2 items split by Chinese comma', () => {
      const md = '**更新说明**: 此次更新同时修改了BANGINGSTRIKE IN，Hydra AT谱面';
      expect(countUpdateNoteChanges(md)).toBe(2);
    });

    it('counts 3 items split by Chinese comma', () => {
      const md = '**更新说明**: 此次更新更改了Archidoxen IN，PANICPARADISE AT，Xepion HD谱面';
      expect(countUpdateNoteChanges(md)).toBe(3);
    });

    it('counts 1 item when no separator is present', () => {
      const md = '**更新说明**: 此次更新调整了QZKagoRequiem.tpazolite - AT谱面';
      expect(countUpdateNoteChanges(md)).toBe(1);
    });

    it('supports Chinese colon', () => {
      const md = '**更新说明**：调整了A IN；B AT';
      expect(countUpdateNoteChanges(md)).toBe(2);
    });

    it('returns 0 when no note exists', () => {
      expect(countUpdateNoteChanges('## 新增曲目\n\n### A')).toBe(0);
    });
  });
});

