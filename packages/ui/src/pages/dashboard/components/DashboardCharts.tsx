import React from 'react';
import type { DashboardChartSeriesDto } from '@nihal-ice-factory/shared-models';
import SalesChartCard from './SalesChartCard';

interface DashboardChartsProps {
  charts: DashboardChartSeriesDto[];
}

const DashboardCharts: React.FC<DashboardChartsProps> = ({ charts }) => {
  return (
    <section className="dashboard-page__charts" aria-label="Sales analytics charts">
      {charts.map((series) => (
        <SalesChartCard key={series.key} series={series} />
      ))}
    </section>
  );
};

export default DashboardCharts;
