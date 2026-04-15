import React from 'react';
import type { DashboardStatDto } from '@nihal-ice-factory/shared-models';
import StatCard from './StatCard';

interface DashboardStatsProps {
  items: DashboardStatDto[];
}

const DashboardStats: React.FC<DashboardStatsProps> = ({ items }) => {
  return (
    <section className="dashboard-page__stats" aria-label="Operational summary">
      {items.map((item) => (
        <StatCard key={item.key} stat={item} />
      ))}
    </section>
  );
};

export default DashboardStats;
