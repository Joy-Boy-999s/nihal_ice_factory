export type DashboardStatTone = 'neutral' | 'primary' | 'success' | 'warning';

export interface DashboardStatDto {
  key: string;
  label: string;
  value: number;
  formatted: string;
  delta?: string;
  tone: DashboardStatTone;
}

export type DashboardChartKind = 'bar' | 'line';

export interface DashboardChartSeriesDto {
  key: string;
  title: string;
  kind: DashboardChartKind;
  labels: string[];
  values: number[];
  accent: string;
}

export interface DashboardMetricsDto {
  generatedAt: string;
  currency: string;
  stats: DashboardStatDto[];
  charts: DashboardChartSeriesDto[];
}
