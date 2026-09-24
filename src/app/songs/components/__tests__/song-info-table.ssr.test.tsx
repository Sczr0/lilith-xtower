import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { SongInfo } from '@/app/lib/info/csv';
import { SongInfoTable } from '../SongInfoTable';

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
});
