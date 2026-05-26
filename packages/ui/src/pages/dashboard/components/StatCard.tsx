import React from 'react';
import type { DashboardStatDto } from '@nihal-ice-factory/shared-models';
import {
  IndianRupeeIcon,
  TrendingUpIcon,
  PackageIcon,
  BarChartIcon,
  SalesIcon,
} from '../../../layout/nav-icons';

interface StatCardProps {
  stat: DashboardStatDto;
}

/** Pick an icon based on stat key keywords → falls back to tone */
function resolveIcon(key: string, tone: string): React.ReactNode {
  const k = key.toLowerCase();
  if (k.includes('revenue') || k.includes('amount') || k.includes('earning'))
    return <IndianRupeeIcon width={20} height={20} />;
  if (k.includes('sale') || k.includes('order') || k.includes('count'))
    return <SalesIcon width={20} height={20} />;
  if (k.includes('can') || k.includes('unit') || k.includes('qty') || k.includes('quantity'))
    return <PackageIcon width={20} height={20} />;
  if (k.includes('trend') || k.includes('growth') || k.includes('up'))
    return <TrendingUpIcon width={20} height={20} />;

  // Fallback: by tone
  switch (tone) {
    case 'primary':  return <TrendingUpIcon width={20} height={20} />;
    case 'success':  return <IndianRupeeIcon width={20} height={20} />;
    case 'warning':  return <PackageIcon width={20} height={20} />;
    default:         return <BarChartIcon width={20} height={20} />;
  }
}

const StatCard: React.FC<StatCardProps> = ({ stat }) => {
  const icon = resolveIcon(stat.key, stat.tone);

  return (
    <article className={`stat-card stat-card--${stat.tone}`}>
      <div className="stat-card__icon" aria-hidden>
        {icon}
      </div>
      <span className="stat-card__label">{stat.label}</span>
      <strong className="stat-card__value">{stat.formatted}</strong>
      {stat.delta && <span className="stat-card__delta">{stat.delta}</span>}
    </article>
  );
};

export default StatCard;
