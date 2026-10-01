import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { SongInfo } from '@/app/lib/info/csv';
import { SONG_INFO_ROW_HEIGHT, SongInfoTable } from '../SongInfoTable';

/**
 * 虚拟化后最容易踩的坑：useVirtualizer 在服务端拿不到滚动元素（outerSize 为 0），
 * 若不传 initialRect 会一行都不渲染，导致静态页首屏出现空表。
 * 这里直接对真实组件做 SSR，锁住「首屏有行 + 不整表输出」两条性质。
 */
function makeSongs(count: number): SongInfo[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `song-${index}`,
    name: `曲目 ${index}`,
    composer: `曲师 ${index}`,
    illustrator: `画师 ${index}`,
    ez: 5,
    hd: 9,
    in: 13,
    at: null,
    chartEz: 'ez-designer',
    chartHd: 'hd-designer',
    chartIn: 'in-designer',
    chartAt: null,
  }));
}

describe('SongInfoTable 服务端渲染', () => {
  const songs = makeSongs(300);

  it('输出首屏可见行，而不是空表', () => {
    const html = renderToStaticMarkup(<SongInfoTable songs={songs} />);
    expect(html).toContain('song-0');
    expect(html).toContain('曲目 0');
  });

  it('只输出首屏附近的行，不整表输出', () => {
    const html = renderToStaticMarkup(<SongInfoTable songs={songs} />);

    expect(html).not.toContain('song-299');

    const ids = html.match(/song-\d+/g) ?? [];
    expect(ids.length).toBeGreaterThan(0);
    // 桌面表格与移动卡片在首帧各渲染一份，两者都应有界（远小于 300）
    expect(ids.length).toBeLessThan(120);
  });

  /**
   * 虚拟化稳定性的三条不变量：列宽只由 colgroup 决定、行高恒为常量、
   * 占位行高度是行高的整数倍（只有「估算值 == 真实行高」时才成立）。
   * 此前估算写死 56 而真实 57，每测量一行就把总高度抬高 1px（实测 25 步涨 113px）。
   */
  it('固定表格布局 + 固定行高 + 分隔线画在单元格上', () => {
    const html = renderToStaticMarkup(<SongInfoTable songs={songs} />);

    expect(html).toContain('table-fixed');
    expect(html).toContain('border-separate');
    expect(html).toMatch(/<td\b[^>]*border-b/);

    const rows = (html.match(/<tr\b[^>]*>/g) ?? []).filter((tag) => tag.includes('data-index='));
    expect(rows.length).toBeGreaterThan(0);
    for (const tag of rows) {
      expect(tag).toContain(`style="height:${SONG_INFO_ROW_HEIGHT}px"`);
      expect(tag).not.toContain('border-b');
    }
  });

  it('占位行高度是行高的整数倍（估算值必须等于真实行高）', () => {
    const html = renderToStaticMarkup(<SongInfoTable songs={songs} />);
    const trTags = html.match(/<tr\b[^>]*>/g) ?? [];
    const spacers = trTags
      .filter((tag) => tag.includes('aria-hidden="true"'))
      .map((tag) => Number(/style="height:(\d+)px/.exec(tag)?.[1] ?? NaN));
    const rowCount = trTags.filter((tag) => tag.includes('data-index=')).length;

    const spacerTotal = spacers.reduce((sum, height) => sum + (Number.isFinite(height) ? height : 0), 0);
    expect(spacerTotal).toBeGreaterThan(0);
    expect(spacerTotal + rowCount * SONG_INFO_ROW_HEIGHT).toBe(songs.length * SONG_INFO_ROW_HEIGHT);
  });

  it('移动端卡片列表用占位元素撑出完整滚动长度', () => {
    // 卡片是绝对定位，滚动范围只会到「已渲染卡片的最低点」；缺了这段占位，
    // 列表长度会随滚动不断变长、滚动条也不反映真实长度。
    const html = renderToStaticMarkup(<SongInfoTable songs={songs} />);
    expect(html).toMatch(
      /<div[^>]*(?:style="height:\d+px"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*style="height:\d+px")[^>]*><\/div>/,
    );
  });
});
