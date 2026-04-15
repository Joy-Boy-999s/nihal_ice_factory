import React from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Card, PageHeader } from '../../components';
import './dashboard.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: { font: { size: 12 }, color: '#64748b' },
    },
    tooltip: {
      backgroundColor: '#0f172a',
      titleFont: { size: 13 },
      bodyFont: { size: 12 },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#64748b' } },
    y: { grid: { color: '#e5e7eb' }, ticks: { color: '#64748b' } },
  },
};

const thisMonth = {
  labels: ['Apr 1', 'Apr 5', 'Apr 10', 'Apr 15', 'Apr 20', 'Apr 23'],
  datasets: [
    {
      label: 'Sales (Rs)',
      data: [200, 350, 400, 300, 500, 250],
      backgroundColor: 'rgba(59, 130, 246, 0.6)',
      borderColor: 'rgba(59, 130, 246, 1)',
      borderWidth: 1,
      borderRadius: 6,
    },
  ],
};

const thisYear = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr'],
  datasets: [
    {
      label: 'Sales (Rs)',
      data: [5000, 6000, 7000, 7900],
      fill: true,
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderColor: 'rgba(16, 185, 129, 1)',
      tension: 0.3,
    },
  ],
};

const thisWeek = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [
    {
      label: 'Sales (Rs)',
      data: [100, 150, 200, 500, 300, 400, 250],
      backgroundColor: 'rgba(236, 72, 153, 0.6)',
      borderColor: 'rgba(236, 72, 153, 1)',
      borderWidth: 1,
      borderRadius: 6,
    },
  ],
};

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  tone?: 'neutral' | 'success' | 'primary' | 'warning';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, delta, tone = 'neutral' }) => (
  <div className={`stat-card stat-card--${tone}`}>
    <span className="stat-card__label">{label}</span>
    <span className="stat-card__value">{value}</span>
    {delta && <span className="stat-card__delta">{delta}</span>}
  </div>
);

const Dashboard: React.FC = () => {
  return (
    <div className="dashboard-page">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your factory performance"
      />

      <div className="dashboard-page__stats">
        <StatCard label="Current Inventory" value="1,250 kg" delta="+4.2% vs last week" tone="primary" />
        <StatCard label="Sales Today" value="Rs 250" delta="2 orders" tone="success" />
        <StatCard label="Sales This Month" value="Rs 7,900" delta="+12% MoM" tone="success" />
        <StatCard label="Pending Deliveries" value="8" delta="2 overdue" tone="warning" />
      </div>

      <div className="dashboard-page__charts">
        <Card title="This Month's Sales">
          <div className="dashboard-page__chart">
            <Bar data={thisMonth} options={chartOptions} />
          </div>
        </Card>
        <Card title="This Year's Sales">
          <div className="dashboard-page__chart">
            <Line data={thisYear} options={chartOptions} />
          </div>
        </Card>
        <Card title="This Week's Sales">
          <div className="dashboard-page__chart">
            <Bar data={thisWeek} options={chartOptions} />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
