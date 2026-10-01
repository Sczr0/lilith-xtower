import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { RksRecord } from '../../../lib/types/score';
import { RKS_TABLE_ROW_HEIGHT, RksRecordsResultsSection } from '../RksRecordsResultsSection';

/**
 * RKS 成绩表虚拟化的回归测试。
 *
 * 背景（用户实测反馈）：表格的列宽由「当前渲染出来的这些行」的内容算出来，虚拟化一滚动就换一批行，
 * 列宽跟着变（实测每滚动一步「排名」列在 60~61.9px 之间变化），进而让歌曲名/操作按钮的折行、
 * 行高在滚动中跳变，整表看起来在抖；同时估算行高（52）与真实行高差太多，滚动期间内容总高度
 * 从 16464px 一路涨到 21377px，滚动条与下方内容持续位移。
 *
 * 这里锁住三条必须成立的不变量（都是上面两个问题的直接防线）：
 * 1. 固定表格布局 + 显式列宽：列宽与渲染了哪些行无关。
 * 2. 每一行的行高都等于 RKS_TABLE_ROW_HEIGHT。
 * 3. 占位行高度是行高的整数倍 —— 只有「估算值 == 真实行高」时才可能成立。
 */
function makeRecords(count: number): RksRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    song_name: `曲目-${index}`,
    difficulty: (['EZ', 'HD', 'IN', 'AT'] as const)[index % 4],
    difficulty_value: 12 + (index % 6) * 0.5,
    acc: 99.12,
    score: 1000000,
    rks: 16.9999,
    push_acc: 98.5,
  }));
}

const RECORDS = makeRecords(300);

function render(): string {
  return renderToStaticMarkup(
    <RksRecordsResultsSection
      isLoading={false}
      records={RECORDS}
      totalMatched={RECORDS.length}
      allRecordsCount={RECORDS.length}
      pushAccHeaderTitle="推分ACC"
      onCopySong={() => {}}
      onOpenSongQuery={() => {}}
      formatPushAcc={() => ({ text: '98.50%', className: '', title: '' })}
    />,
  );
}

/** 取出所有 <tr ...> 开标签的属性。 */
function trTags(html: string): string[] {
  return html.match(/<tr\b[^>]*>/g) ?? [];
}

describe('RksRecordsResultsSection 桌面表格虚拟化', () => {
  it('服务端输出首屏行，而不是空表，也不整表输出', () => {
    const html = render();

    expect(html).toContain('曲目-0');
    expect(html).not.toContain('曲目-299');
  });

  it('固定表格布局 + 显式列宽（列宽不随渲染了哪些行变化）', () => {
    const html = render();

    expect(html).toContain('table-fixed');
    expect(html).toContain('border-separate');

    const cols = [...html.matchAll(/<col\b[^>]*style="width:(\d+)px"/g)].map((m) => Number(m[1]));
    expect(cols.length).toBeGreaterThan(0);
    // 列宽合计必须等于表格 min-w，否则窄视口下列会被压缩、内容溢出/折行，行高再次不稳定
    const minWidth = Number(/min-w-\[(\d+)px\]/.exec(html)?.[1]);
    expect(minWidth).toBeGreaterThan(0);
    expect(cols.reduce((sum, width) => sum + width, 0)).toBe(minWidth);
  });

  it('每个数据行的行高都等于估算行高', () => {
    const html = render();
    const rows = trTags(html).filter((tag) => tag.includes('data-index='));

    expect(rows.length).toBeGreaterThan(0);
    for (const tag of rows) {
      expect(tag).toContain(`style="height:${RKS_TABLE_ROW_HEIGHT}px"`);
    }
  });

  it('占位行高度是行高的整数倍（估算值必须等于真实行高）', () => {
    const html = render();
    const spacers = trTags(html)
      .filter((tag) => tag.includes('aria-hidden="true"'))
      .map((tag) => Number(/style="height:(\d+)px/.exec(tag)?.[1] ?? NaN));

    const totalSize = RECORDS.length * RKS_TABLE_ROW_HEIGHT;
    const rowCount = trTags(html).filter((tag) => tag.includes('data-index=')).length;

    // 没有任何测量时，整个表高只能由「估算行高 × 行数」构成
    const spacerTotal = spacers.reduce((sum, height) => sum + (Number.isFinite(height) ? height : 0), 0);
    expect(spacerTotal).toBeGreaterThan(0);
    expect(spacerTotal + rowCount * RKS_TABLE_ROW_HEIGHT).toBe(totalSize);
  });

  it('分隔线画在单元格上（border-separate 下 tr 不画边框）', () => {
    const html = render();

    expect(html).toMatch(/<td\b[^>]*border-b/);
    expect(html).toMatch(/<th\b[^>]*border-b/);
    // tr 上再挂 border-b 只会让人误以为生效
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
