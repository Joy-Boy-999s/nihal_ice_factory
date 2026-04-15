import React from 'react';
import type { DashboardStatDto } from '@nihal-ice-factory/shared-models';

interface StatCardProps {
  stat: DashboardStatDto;
}

const StatCard: React.FC<StatCardProps> = ({ stat }) => {
  return (
    <article className={`stat-card stat-card--${stat.tone}`}>
      <span className="stat-card__label">{stat.label}</span>
      <strong className="stat-card__value">{stat.formatted}</strong>
      {stat.delta && <span className="stat-card__delta">{stat.delta}</span>}
    </article>
  );
};

export default StatCard;
