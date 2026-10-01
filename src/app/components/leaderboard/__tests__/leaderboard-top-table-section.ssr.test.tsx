import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { LeaderboardTopItem } from '../../../lib/types/leaderboard';
import {
  LEADERBOARD_TABLE_ROW_HEIGHT,
  LeaderboardTopTableSection,
} from '../LeaderboardTopTableSection';

/**
 * 排行榜桌面表格虚拟化的回归测试。
 *
 * 背景（实测）：自动表格布局 + 虚拟化会让列宽随渲染窗口变化（25 步内出现 15 组不同列宽），
 * 别名折行与否随之改变，行高在 61 / 60.5 之间来回跳、可见行整体位移，内容总高度
 * 从 17221px 漂到 17644px。这里锁住同样的不变量：固定布局 + 显式列宽、行高等于常量、
 * 占位行高度是行高的整数倍（即估算值 == 真实行高）。
 */
function makeItems(count: number): LeaderboardTopItem[] {
  return Array.from({ length: count }, (_, index) => ({
    rank: index + 1,
    user: `user-${index}-abcdef0123456789`,
    score: 16.9 - index * 0.001,
    updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index % 60)).toISOString(),
    alias: index % 4 === 0 ? null : `玩家 ${index}`,
  }));
}

const ITEMS = makeItems(300);

function render(): string {
  return renderToStaticMarkup(
    <LeaderboardTopTableSection
      topItems={ITEMS}
      topTotal={ITEMS.length}
      isTopLoading={false}
      topError={null}
      topPageSize={50}
      topPageSizeOptions={[
        { label: '50 条', value: '50' },
        { label: '100 条', value: '100' },
      ]}
      canLoadMore
      copyHint={null}
      onTopPageSizeChange={() => {}}
      onRefreshTop={() => {}}
      onLoadMore={() => {}}
      onLookupAlias={() => {}}
      onCopyUser={() => {}}
      onScrollToTop={() => {}}
      formatDateTime={(value) => value.slice(0, 16)}
    />,
  );
}

function trTags(html: string): string[] {
  return html.match(/<tr\b[^>]*>/g) ?? [];
}

describe('LeaderboardTopTableSection 桌面表格虚拟化', () => {
  it('服务端输出首屏行，而不是空表，也不整表输出', () => {
    const html = render();

    expect(html).toContain('玩家 1');
    expect(html).not.toContain('玩家 299');
  });

  it('固定表格布局 + 显式列宽合计 100%', () => {
    const html = render();

    expect(html).toContain('table-fixed');
    expect(html).toContain('border-separate');

    const percents = [...html.matchAll(/<col\b[^>]*style="width:([\d.]+)%"/g)].map((m) => Number(m[1]));
    expect(percents).toHaveLength(5);
    expect(percents.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 5);
  });

  it('每个数据行的行高都等于估算行高', () => {
    const html = render();
    const rows = trTags(html).filter((tag) => tag.includes('data-index='));

    expect(rows.length).toBeGreaterThan(0);
    for (const tag of rows) {
      expect(tag).toContain(`style="height:${LEADERBOARD_TABLE_ROW_HEIGHT}px"`);
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
    expect(spacerTotal + rowCount * LEADERBOARD_TABLE_ROW_HEIGHT).toBe(
      ITEMS.length * LEADERBOARD_TABLE_ROW_HEIGHT,
    );
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
