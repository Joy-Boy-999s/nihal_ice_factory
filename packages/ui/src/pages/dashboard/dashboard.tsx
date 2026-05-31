import React, { Suspense, lazy } from 'react';
import { Card, PageHeader } from '../../components';
import DashboardSkeleton from './components/DashboardSkeleton';
import DashboardToolbar from './components/DashboardToolbar';
import ConversionSummaryCard from './components/ConversionSummaryCard';
import { useDashboardMetrics } from './utils/use-dashboard-metrics';
import { useDashboardSeo } from './utils/use-dashboard-seo';
import './styles/dashboard.css';

const DashboardStats = lazy(() => import('./components/DashboardStats'));
const DashboardCharts = lazy(() => import('./components/DashboardCharts'));

const SEO_TITLE = 'Dashboard | Nihal Ice Factory ERP';
const SEO_DESCRIPTION =
  'Live ERP dashboard with real-time sales insights, monthly trends, and weekly performance for Nihal Ice Factory.';

const Dashboard: React.FC = () => {
  const { metrics, loading, refreshing, error, lastUpdated, refresh } = useDashboardMetrics();

  useDashboardSeo({ title: SEO_TITLE, description: SEO_DESCRIPTION });

  const subtitle = lastUpdated
    ? `Real-time sales performance · updated ${lastUpdated}`
    : 'Real-time sales performance across all units';

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Dashboard"
        subtitle={subtitle}
        actions={
          <DashboardToolbar
            lastUpdated={lastUpdated}
            refreshing={refreshing}
            onRefresh={refresh}
          />
        }
      />

      {error && (
        <div role="alert">
          <Card className="dashboard-page__error">
            <strong>Unable to load dashboard.</strong> {error}
          </Card>
        </div>
      )}

      {loading && !metrics ? (
        <>
          <DashboardSkeleton variant="stats" />
          <DashboardSkeleton variant="charts" />
        </>
      ) : (
        metrics && (
          <>
            <Suspense fallback={<DashboardSkeleton variant="stats" />}>
              <DashboardStats items={metrics.stats} />
            </Suspense>
            <Suspense fallback={<DashboardSkeleton variant="charts" />}>
              <DashboardCharts charts={metrics.charts} />
            </Suspense>
            <ConversionSummaryCard />
          </>
        )
      )}
    </div>
  );
};

export default Dashboard;
