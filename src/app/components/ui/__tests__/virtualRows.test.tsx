import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { useVirtualRows } from '../virtualRows';

function Probe({ count }: { count: number }) {
  const { virtualItems } = useVirtualRows(count, 50);
  return (
    <ul>
      {virtualItems.map((item) => (
        <li key={item.index} data-index={item.index}>
          {`row-${item.index}`}
        </li>
      ))}
    </ul>
  );
}

describe('useVirtualRows 服务端渲染', () => {
  it('未挂载（无滚动元素）时仍渲染首屏可见行，而不是一行不渲染', () => {
    const html = renderToStaticMarkup(<Probe count={200} />);

    // 回归保护：此前未传 initialRect，outerSize 为 0 导致服务端一行都不输出。
    expect(html).toContain('row-0');
  });

  it('服务端只渲染首屏附近的行，不会整表输出', () => {
    const html = renderToStaticMarkup(<Probe count={200} />);
    const rendered = html.match(/row-\d+/g) ?? [];

    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(40);
    expect(html).not.toContain('row-199');
  });
});
