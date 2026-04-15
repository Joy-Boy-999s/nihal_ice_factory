import React, { useMemo } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import type { DashboardChartSeriesDto } from '@nihal-ice-factory/shared-models';
import { Card } from '../../../components';
import { barOptions, lineOptions } from '../utils/chart-config';
import { toBarData, toLineData } from '../utils/to-chart-data';

interface SalesChartCardProps {
  series: DashboardChartSeriesDto;
}

const SalesChartCard: React.FC<SalesChartCardProps> = ({ series }) => {
  const total = useMemo(
    () => series.values.reduce((sum, value) => sum + value, 0),
    [series.values],
  );

  const formattedTotal = useMemo(
    () =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(total),
    [total],
  );

  return (
    <Card title={series.title} className="dashboard-page__chart-card">
      <div className="dashboard-page__chart-total">
        <span className="dashboard-page__chart-total-label">Total</span>
        <strong className="dashboard-page__chart-total-value">{formattedTotal}</strong>
      </div>
      <div className="dashboard-page__chart" role="img" aria-label={series.title}>
        {series.kind === 'line' ? (
          <Line data={toLineData(series)} options={lineOptions} />
        ) : (
          <Bar data={toBarData(series)} options={barOptions} />
        )}
      </div>
    </Card>
  );
};

export default SalesChartCard;
