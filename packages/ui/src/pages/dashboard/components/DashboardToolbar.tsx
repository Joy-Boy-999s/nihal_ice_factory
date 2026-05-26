import React from 'react';
import { Button } from '../../../components';
import { RefreshIcon } from '../../../layout/nav-icons';

interface DashboardToolbarProps {
  lastUpdated: string;
  refreshing: boolean;
  onRefresh: () => void;
}

const DashboardToolbar: React.FC<DashboardToolbarProps> = ({
  lastUpdated,
  refreshing,
  onRefresh,
}) => {
  return (
    <div className="dashboard-page__toolbar">
      <span className="dashboard-page__live-chip" role="status" aria-live="polite">
        <span className="dashboard-page__live-dot" aria-hidden />
        Live
        {lastUpdated && <span className="dashboard-page__live-time">· {lastUpdated}</span>}
      </span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onRefresh}
        loading={refreshing}
        aria-label="Refresh dashboard metrics"
        leftIcon={!refreshing ? <RefreshIcon width={14} height={14} /> : undefined}
      >
        Refresh
      </Button>
    </div>
  );
};

export default DashboardToolbar;
