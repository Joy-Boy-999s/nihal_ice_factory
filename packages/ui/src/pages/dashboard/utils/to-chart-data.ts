import type { ChartData } from 'chart.js';
import type { DashboardChartSeriesDto } from '@nihal-ice-factory/shared-models';

const withAlpha = (hex: string, alpha: number): string => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const toBarData = (series: DashboardChartSeriesDto): ChartData<'bar'> => ({
  labels: series.labels,
  datasets: [
    {
      label: 'Sales (Rs)',
      data: series.values,
      backgroundColor: withAlpha(series.accent, 0.65),
      borderColor: series.accent,
      borderWidth: 1,
      borderRadius: 6,
    },
  ],
});

export const toLineData = (series: DashboardChartSeriesDto): ChartData<'line'> => ({
  labels: series.labels,
  datasets: [
    {
      label: 'Sales (Rs)',
      data: series.values,
      fill: true,
      backgroundColor: withAlpha(series.accent, 0.13),
      borderColor: series.accent,
      pointBackgroundColor: series.accent,
      pointRadius: 3,
      tension: 0.34,
    },
  ],
});
