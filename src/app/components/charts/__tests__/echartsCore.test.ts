// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as echarts from 'echarts/core';

// 触发按需注册（与两个图表组件共用同一 echarts 单例）
import '../echartsCore';

/**
 * 覆盖两个图表组件用到的 option 子集（StatsLineChart / RksHistoryPanel）。
 * 一旦漏注册某个图表或组件，echarts 会打印 “… is used but not imported”，
 * 或直接抛 “… is used but not imported” 的异常。
 */
const LINE_OPTION = {
  backgroundColor: 'transparent',
  title: { text: 'RKS 趋势' },
  legend: { data: ['RKS'] },
  tooltip: { trigger: 'axis', axisPointer: { type: 'line' } },
  toolbox: {
    feature: {
      saveAsImage: { title: '保存图片', pixelRatio: 2 },
      dataView: { title: '数据', readOnly: true },
    },
  },
  xAxis: { type: 'category', data: ['a', 'b'] },
  yAxis: { type: 'value' },
  series: [{ name: 'RKS', type: 'line', data: [1, 2], areaStyle: { opacity: 0.16 } }],
};

describe('echartsCore 按需注册完整性', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('折线图所需图表/组件均已注册，且 dark 主题可用', () => {
    const messages: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      messages.push(args.map(String).join(' '));
    });
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      messages.push(args.map(String).join(' '));
    });

    const container = document.createElement('div');
    document.body.appendChild(container);

    const chart = echarts.init(container, 'dark', { renderer: 'svg', width: 600, height: 300 });
    chart.setOption(LINE_OPTION);

    // 正向确认 option 确实生效（避免空跑通过）
    const applied = chart.getOption() as { series?: unknown[] };
    expect(Array.isArray(applied.series)).toBe(true);
    expect(applied.series).toHaveLength(1);

    chart.dispose();
    container.remove();

    expect(messages.filter((m) => /not imported|not exists|Unknown (component|series)/i.test(m))).toEqual([]);
  });
});
