import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { SongInfo } from '@/app/lib/info/csv';
import { CHART_LEVELS_ROW_HEIGHT, ChartLevelsTable } from '../ChartLevelsTable';

/**
 * 定数表虚拟化的回归测试。
 *
 * 背景（实测）：自动表格布局的列宽由「当前渲染出来的这些行」的内容算出，虚拟化一滚动就换一批行，
 * 列宽随之变化（25 步内出现 17 组不同列宽），曲名/曲师折行结果跟着变，行高在滚动中跳 4~32px，
 * 内容总高度也从 17253px 一路飘到 17952px。这里锁住同样的三条不变量：
 * 固定布局 + 显式列宽、行高等于常量、占位行高度是行高的整数倍（即估算值 == 真实行高）。
 */
function makeSongs(count: number): SongInfo[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `song.id.${index}`,
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

const SONGS = makeSongs(300);

function render(): string {
  return renderToStaticMarkup(<ChartLevelsTable songs={SONGS} />);
}

function trTags(html: string): string[] {
  return html.match(/<tr\b[^>]*>/g) ?? [];
}

function colPercents(html: string): number[] {
  return [...html.matchAll(/<col\b[^>]*style="width:([\d.]+)%"/g)].map((m) => Number(m[1]));
}

describe('ChartLevelsTable 桌面表格虚拟化', () => {
  it('服务端输出首屏行，而不是空表，也不整表输出', () => {
    const html = render();

    expect(html).toContain('曲目 0');
    expect(html).not.toContain('曲目 299');
  });

  it('固定表格布局 + 显式列宽合计 100%', () => {
    const html = render();

    expect(html).toContain('table-fixed');
    expect(html).toContain('border-separate');

    const percents = colPercents(html);
    // 默认「全部」筛选：曲目/曲师/画师 + EZ/HD/IN/AT 共 7 列
    expect(percents).toHaveLength(7);
    expect(percents.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 5);
  });

  it('每个数据行的行高都等于估算行高', () => {
    const html = render();
    const rows = trTags(html).filter((tag) => tag.includes('data-index='));

    expect(rows.length).toBeGreaterThan(0);
    for (const tag of rows) {
      expect(tag).toContain(`style="height:${CHART_LEVELS_ROW_HEIGHT}px"`);
    }
  });

  it('占位行高度是行高的整数倍（估算值必须等于真实行高）', () => {
    const html = render();
    const spacers = trTags(html)
      .filter((tag) => tag.includes('aria-hidden="true"'))
      .map((tag) => Number(/style="height:(\d+)px/.exec(tag)?.[1] ?? NaN));
    const rowCount = trTags(html).filter((tag) => tag.includes('data-index=')).length;

    const spacerTotal = spacers.reduce((sum, height) => sum + (Number.isFinite(height) ? height : 0), 0);
    expect(spacerTotal).toBeGreaterThan(0);
    expect(spacerTotal + rowCount * CHART_LEVELS_ROW_HEIGHT).toBe(SONGS.length * CHART_LEVELS_ROW_HEIGHT);
  });

  it('分隔线画在单元格上（border-separate 下 tr 不画边框）', () => {
    const html = render();

    expect(html).toMatch(/<td\b[^>]*border-b/);
    expect(html).toMatch(/<th\b[^>]*border-b/);
    for (const tag of trTags(html)) {
      expect(tag).not.toContain('border-b');
    }
  });

  it('移动端卡片列表用占位元素撑出完整滚动长度', () => {
    // 卡片是绝对定位，滚动范围只会到「已渲染卡片的最低点」；缺了这段占位，
    // 列表长度会随滚动不断变长、滚动条也不反映真实长度。
    const html = render();
    expect(html).toMatch(
      /<div[^>]*(?:style="height:\d+px"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*style="height:\d+px")[^>]*><\/div>/,
    );
  });
});
