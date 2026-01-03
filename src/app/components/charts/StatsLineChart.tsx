"use client";

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { useTheme } from 'next-themes';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

export type StatsLineChartSeries = {
  name: string;
  data: number[];
  color?: string;
  area?: boolean;
};

type Props = {
  title: string;
  xAxis: string[];
  series: StatsLineChartSeries[];
  height?: number;
  className?: string;
};

const usePrefersReducedMotion = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  } catch {
    return false;
  }
};

export function StatsLineChart({ title, xAxis, series, height = 260, className }: Props) {
  const { theme, resolvedTheme } = useTheme();
  const effectiveTheme = (theme === 'system' ? resolvedTheme : theme) as 'light' | 'dark' | undefined;
  const isDark = effectiveTheme === 'dark';
  const prefersReducedMotion = usePrefersReducedMotion();

  const option = useMemo(() => {
    const axisLabelColor = isDark ? '#a3a3a3' : '#6b7280';
    const axisLineColor = isDark ? '#404040' : '#e5e7eb';
    const tooltipBg = isDark ? 'rgba(23,23,23,0.92)' : 'rgba(255,255,255,0.96)';
    const tooltipBorder = isDark ? '#262626' : '#e5e7eb';
    const tooltipText = isDark ? '#e5e7eb' : '#111827';

    return {
      backgroundColor: 'transparent',
      animation: !prefersReducedMotion,
      animationDuration: 700,
      animationEasing: 'cubicOut',
      grid: { left: 16, right: 16, top: 52, bottom: 28, containLabel: true },
      title: {
        text: title,
        left: 8,
        top: 8,
        textStyle: { fontSize: 14, fontWeight: 600, color: isDark ? '#f5f5f5' : '#111827' },
      },
      legend: {
        top: 10,
        right: 10,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: axisLabelColor },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: tooltipText },
      },
      xAxis: {
        type: 'category',
        data: xAxis,
        boundaryGap: false,
        axisLine: { lineStyle: { color: axisLineColor } },
        axisLabel: { color: axisLabelColor },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: axisLineColor } },
        splitLine: { lineStyle: { color: axisLineColor, opacity: isDark ? 0.25 : 0.4 } },
        axisLabel: { color: axisLabelColor },
      },
      series: series.map((item, seriesIndex) => ({
        name: item.name,
        type: 'line',
        data: item.data,
        smooth: true,
        showSymbol: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: item.color },
        itemStyle: { color: item.color },
        areaStyle: item.area ? { opacity: 0.16 } : undefined,
        emphasis: { focus: 'series' },
        animationDelay: (idx: number) => idx * 36 + seriesIndex * 90,
        animationDelayUpdate: (idx: number) => idx * 18,
      })),
    };
  }, [isDark, prefersReducedMotion, series, title, xAxis]);

  return (
    <div className={className}>
      <ReactECharts
        option={option}
        theme={isDark ? 'dark' : undefined}
        style={{ width: '100%', height }}
        opts={{ renderer: 'svg' }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}

