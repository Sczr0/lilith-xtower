'use client';

import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import EChartsReactCore from 'echarts-for-react/lib/core';
import type { EChartsReactProps } from 'echarts-for-react';

// 只注册本站图表实际用到的能力，替代 echarts-for-react 默认入口的整包 echarts
// （整包约 1.1MB，含 treemap/sankey/geo 等未使用图表类型）。
// TooltipComponent 内部已 use(axisPointer)，ToolboxComponent 内部已注册
// saveAsImage/dataView 等 feature，无需重复注册。
echarts.use([
  LineChart,
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  ToolboxComponent,
  SVGRenderer,
]);

// 官方 dark 主题是 UMD 副作用模块，内部 require echarts/lib/echarts，会连带打包
// Canvas 渲染器/Dataset/LabelLayout；此处按需注册等价 token。
const DARK_THEME = {
  darkMode: true,
  backgroundColor: 'transparent',
  color: [
    '#4992ff',
    '#7cffb2',
    '#fddd60',
    '#ff6e76',
    '#58d9f9',
    '#05c091',
    '#ff8a45',
    '#8d48e3',
    '#dd79ff',
  ],
  textStyle: { color: '#B9B8CE' },
  title: {
    textStyle: { color: '#EEF1FA' },
    subtextStyle: { color: '#B9B8CE' },
  },
  legend: { textStyle: { color: '#B9B8CE' } },
  axisPointer: {
    lineStyle: { color: '#817f91' },
    crossStyle: { color: '#817f91' },
    label: { color: '#fff' },
  },
  toolbox: { iconStyle: { borderColor: '#B9B8CE' } },
  categoryAxis: { splitLine: { show: false } },
};

echarts.registerTheme('dark', DARK_THEME);

export default function EChartsCore(props: Omit<EChartsReactProps, 'echarts'>) {
  return <EChartsReactCore echarts={echarts} {...props} />;
}
