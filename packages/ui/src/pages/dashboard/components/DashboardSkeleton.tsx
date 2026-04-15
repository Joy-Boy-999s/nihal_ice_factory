import React from 'react';

interface DashboardSkeletonProps {
  variant: 'stats' | 'charts';
}

const STATS_COUNT = 4;
const CHARTS_COUNT = 3;

const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({ variant }) => {
  if (variant === 'stats') {
    return (
      <div className="dashboard-page__stats" aria-hidden>
        {Array.from({ length: STATS_COUNT }).map((_, idx) => (
          <div key={idx} className="dashboard-skeleton dashboard-skeleton--stat" />
        ))}
      </div>
    );
  }
  return (
    <div className="dashboard-page__charts" aria-hidden>
      {Array.from({ length: CHARTS_COUNT }).map((_, idx) => (
        <div key={idx} className="dashboard-skeleton dashboard-skeleton--chart" />
      ))}
    </div>
  );
};

export default DashboardSkeleton;
